import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { BalanceService } from '../ledger/balance.service';
import { FraudService } from './fraud.service';
import { WithdrawalStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { QUEUE_NAMES, JOB_TYPES, UI_COPY } from '@crypto-stake/shared';

@Injectable()
export class WithdrawalsService {
  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
    private fraudService: FraudService,
    @InjectQueue(QUEUE_NAMES.PAYOUT_PROCESSOR) private payoutQueue: Queue,
  ) {}

  /**
   * Create a withdrawal request (USER action)
   * Users can ONLY create requests. They cannot execute payouts.
   */
  async createRequest(
    userId: string,
    params: {
      assetId: string;
      chainId: string;
      amount: string;
      destinationAddress: string;
      userNotes?: string;
      idempotencyKey: string;
    },
  ) {
    // Check idempotency
    const existing = await this.prisma.withdrawalRequest.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });

    if (existing) {
      return existing; // Return existing request for idempotent behavior
    }

    const amount = new Decimal(params.amount);

    // Get asset for fee calculation
    const asset = await this.prisma.asset.findUnique({
      where: { id: params.assetId },
      include: { chain: true },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    if (!asset.isActive) {
      throw new BadRequestException('Asset is not available for withdrawal');
    }

    // Calculate fee (example: 0.1% with minimum)
    const feePercent = new Decimal('0.001');
    const minFee = new Decimal('0.0001');
    let fee = amount.mul(feePercent);
    if (fee.lessThan(minFee)) {
      fee = minFee;
    }

    const netAmount = amount.sub(fee);
    if (netAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Amount too small after fees');
    }

    return this.prisma.executeInTransaction(async (tx) => {
      // Verify user has sufficient balance
      const balance = await tx.balanceCache.findUnique({
        where: {
          userId_assetId_chainId: {
            userId,
            assetId: params.assetId,
            chainId: params.chainId,
          },
        },
      });

      if (!balance || balance.available.lessThan(amount)) {
        throw new BadRequestException('Insufficient available balance');
      }

      // Run fraud analysis
      const fraudAnalysis = await this.fraudService.analyzeWithdrawalRequest({
        userId,
        destinationAddress: params.destinationAddress,
        amount,
        assetId: params.assetId,
        chainId: params.chainId,
      });

      // Add address to whitelist (with cooldown)
      await this.fraudService.addToWhitelist(
        userId,
        params.chainId,
        params.destinationAddress,
      );

      // Create withdrawal request
      const request = await tx.withdrawalRequest.create({
        data: {
          userId,
          assetId: params.assetId,
          chainId: params.chainId,
          amount,
          fee,
          netAmount,
          destinationAddress: params.destinationAddress.toLowerCase(),
          status: 'PENDING_REVIEW',
          userNotes: params.userNotes,
          idempotencyKey: params.idempotencyKey,
          fraudScore: fraudAnalysis.totalScore,
          fraudIndicators: fraudAnalysis.indicators,
        },
      });

      // Reserve funds (debit from available, add to pending)
      await this.balanceService.reserveForWithdrawal(tx, {
        userId,
        assetId: params.assetId,
        chainId: params.chainId,
        amount,
        withdrawalRequestId: request.id,
      });

      return {
        ...request,
        message: UI_COPY.WITHDRAWAL_DISCLAIMER,
      };
    });
  }

  /**
   * Get user's withdrawal requests
   */
  async getUserRequests(userId: string, options?: { status?: WithdrawalStatus }) {
    return this.prisma.withdrawalRequest.findMany({
      where: {
        userId,
        ...(options?.status && { status: options.status }),
      },
      include: {
        asset: true,
        chain: true,
        payoutTx: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get withdrawal request by ID
   */
  async getRequestById(id: string, userId?: string) {
    const request = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            kycStatus: true,
            createdAt: true,
          },
        },
        asset: true,
        chain: true,
        payoutTx: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Withdrawal request not found');
    }

    // If userId provided, verify ownership
    if (userId && request.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return request;
  }

  // ==================== ADMIN ONLY ACTIONS ====================

  /**
   * Approve withdrawal request (ADMIN action)
   * This DOES NOT execute the payout - it only approves and enqueues
   */
  async approveRequest(
    requestId: string,
    adminId: string,
    adminNotes?: string,
  ) {
    return this.prisma.executeInTransaction(async (tx) => {
      const request = await tx.withdrawalRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new NotFoundException('Withdrawal request not found');
      }

      if (request.status !== 'PENDING_REVIEW') {
        throw new BadRequestException(`Cannot approve request in status: ${request.status}`);
      }

      // Update status
      const updated = await tx.withdrawalRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedBy: adminId,
          reviewedAt: new Date(),
          adminNotes,
        },
      });

      // Enqueue payout job
      await this.payoutQueue.add(
        JOB_TYPES.PROCESS_PAYOUT,
        { withdrawalRequestId: requestId },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000, // 1 minute
          },
        },
      );

      return updated;
    });
  }

  /**
   * Reject withdrawal request (ADMIN action)
   */
  async rejectRequest(
    requestId: string,
    adminId: string,
    adminNotes: string,
  ) {
    return this.prisma.executeInTransaction(async (tx) => {
      const request = await tx.withdrawalRequest.findUnique({
        where: { id: requestId },
        include: { asset: true },
      });

      if (!request) {
        throw new NotFoundException('Withdrawal request not found');
      }

      if (request.status !== 'PENDING_REVIEW') {
        throw new BadRequestException(`Cannot reject request in status: ${request.status}`);
      }

      // Update status
      const updated = await tx.withdrawalRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          reviewedBy: adminId,
          reviewedAt: new Date(),
          adminNotes,
        },
      });

      // Release reserved funds back to user's available balance
      await this.balanceService.releaseReservedFunds(tx, {
        userId: request.userId,
        assetId: request.assetId,
        chainId: request.chainId,
        amount: request.amount,
        withdrawalRequestId: requestId,
      });

      return updated;
    });
  }

  /**
   * Mark as paid manually (ADMIN action)
   * For when payout is done outside the system
   */
  async markPaidManually(
    requestId: string,
    adminId: string,
    params: {
      proofUrl?: string;
      adminNotes: string;
    },
  ) {
    return this.prisma.executeInTransaction(async (tx) => {
      const request = await tx.withdrawalRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new NotFoundException('Withdrawal request not found');
      }

      if (!['PENDING_REVIEW', 'APPROVED', 'FAILED'].includes(request.status)) {
        throw new BadRequestException(`Cannot mark as paid manually in status: ${request.status}`);
      }

      // Update status
      const updated = await tx.withdrawalRequest.update({
        where: { id: requestId },
        data: {
          status: 'PAID_MANUALLY',
          reviewedBy: adminId,
          reviewedAt: new Date(),
          manualProofUrl: params.proofUrl,
          manualProofNotes: params.adminNotes,
          adminNotes: params.adminNotes,
        },
      });

      // Finalize withdrawal (clear pending balance)
      await this.balanceService.finalizeWithdrawal(tx, {
        userId: request.userId,
        assetId: request.assetId,
        chainId: request.chainId,
        amount: request.amount,
        withdrawalRequestId: requestId,
      });

      return updated;
    });
  }

  /**
   * Get withdrawal queue for admin
   */
  async getWithdrawalQueue(options?: {
    status?: WithdrawalStatus;
    page?: number;
    limit?: number;
  }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where = options?.status ? { status: options.status } : {};

    const [items, total] = await Promise.all([
      this.prisma.withdrawalRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              kycStatus: true,
              createdAt: true,
              twoFactorEnabled: true,
            },
          },
          asset: true,
          chain: true,
          payoutTx: true,
        },
        orderBy: [
          { status: 'asc' }, // PENDING_REVIEW first
          { createdAt: 'asc' }, // Oldest first
        ],
        take: limit,
        skip,
      }),
      this.prisma.withdrawalRequest.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update payout transaction status (called by worker)
   */
  async updatePayoutStatus(
    requestId: string,
    params: {
      status: 'SENT' | 'CONFIRMING' | 'CONFIRMED' | 'FAILED';
      txHash?: string;
      confirmations?: number;
      errorMessage?: string;
    },
  ) {
    return this.prisma.executeInTransaction(async (tx) => {
      const request = await tx.withdrawalRequest.findUnique({
        where: { id: requestId },
        include: { payoutTx: true },
      });

      if (!request) {
        throw new NotFoundException('Withdrawal request not found');
      }

      // Update or create payout tx record
      await tx.payoutTx.upsert({
        where: { withdrawalRequestId: requestId },
        create: {
          withdrawalRequestId: requestId,
          txHash: params.txHash,
          status: params.status,
          confirmations: params.confirmations || 0,
          errorMessage: params.errorMessage,
          ...(params.status === 'SENT' && { sentAt: new Date() }),
          ...(params.status === 'CONFIRMED' && { confirmedAt: new Date() }),
        },
        update: {
          txHash: params.txHash,
          status: params.status,
          confirmations: params.confirmations,
          errorMessage: params.errorMessage,
          ...(params.status === 'SENT' && { sentAt: new Date() }),
          ...(params.status === 'CONFIRMED' && { confirmedAt: new Date() }),
        },
      });

      // Map payout status to withdrawal status
      let withdrawalStatus: WithdrawalStatus;
      switch (params.status) {
        case 'SENT':
          withdrawalStatus = 'SENT';
          break;
        case 'CONFIRMING':
          withdrawalStatus = 'CONFIRMING';
          break;
        case 'CONFIRMED':
          withdrawalStatus = 'COMPLETED';
          // Finalize withdrawal
          await this.balanceService.finalizeWithdrawal(tx, {
            userId: request.userId,
            assetId: request.assetId,
            chainId: request.chainId,
            amount: request.amount,
            withdrawalRequestId: requestId,
            txHash: params.txHash,
          });
          break;
        case 'FAILED':
          withdrawalStatus = 'FAILED';
          break;
        default:
          withdrawalStatus = request.status;
      }

      return tx.withdrawalRequest.update({
        where: { id: requestId },
        data: { status: withdrawalStatus },
      });
    });
  }
}
