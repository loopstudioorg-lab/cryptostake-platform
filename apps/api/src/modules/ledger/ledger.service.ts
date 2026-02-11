import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerEntryType, LedgerDirection, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateLedgerEntryParams {
  userId: string | null;
  assetId: string;
  chainId: string;
  entryType: LedgerEntryType;
  direction: LedgerDirection;
  amount: Decimal | string;
  referenceType: string;
  referenceId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class LedgerService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a ledger entry within a transaction.
   * This should ALWAYS be called within a Prisma transaction.
   */
  async createEntry(
    tx: Prisma.TransactionClient,
    params: CreateLedgerEntryParams,
  ) {
    const amount = typeof params.amount === 'string' 
      ? new Decimal(params.amount) 
      : params.amount;

    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Ledger entry amount must be positive');
    }

    // Calculate balance after this entry
    let balanceAfter: Decimal | null = null;

    if (params.userId) {
      const currentBalance = await this.calculateBalance(
        tx,
        params.userId,
        params.assetId,
        params.chainId,
      );

      if (params.direction === 'CREDIT') {
        balanceAfter = currentBalance.add(amount);
      } else {
        balanceAfter = currentBalance.subtract(amount);
        if (balanceAfter.lessThan(0)) {
          throw new BadRequestException('Insufficient balance for debit');
        }
      }
    }

    return tx.ledgerEntry.create({
      data: {
        userId: params.userId,
        assetId: params.assetId,
        chainId: params.chainId,
        entryType: params.entryType,
        direction: params.direction,
        amount,
        balanceAfter,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        metadata: params.metadata || {},
      },
    });
  }

  /**
   * Calculate the current balance from ledger entries
   */
  async calculateBalance(
    tx: Prisma.TransactionClient,
    userId: string,
    assetId: string,
    chainId: string,
  ): Promise<Decimal> {
    const result = await tx.ledgerEntry.aggregate({
      where: {
        userId,
        assetId,
        chainId,
      },
      _sum: {
        amount: true,
      },
    });

    // Get credits and debits separately
    const credits = await tx.ledgerEntry.aggregate({
      where: { userId, assetId, chainId, direction: 'CREDIT' },
      _sum: { amount: true },
    });

    const debits = await tx.ledgerEntry.aggregate({
      where: { userId, assetId, chainId, direction: 'DEBIT' },
      _sum: { amount: true },
    });

    const creditSum = credits._sum.amount || new Decimal(0);
    const debitSum = debits._sum.amount || new Decimal(0);

    return creditSum.minus(debitSum);
  }

  /**
   * Get ledger entries for a user
   */
  async getUserEntries(
    userId: string,
    options?: {
      assetId?: string;
      chainId?: string;
      entryType?: LedgerEntryType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: Prisma.LedgerEntryWhereInput = {
      userId,
      ...(options?.assetId && { assetId: options.assetId }),
      ...(options?.chainId && { chainId: options.chainId }),
      ...(options?.entryType && { entryType: options.entryType }),
      ...(options?.startDate || options?.endDate
        ? {
            createdAt: {
              ...(options.startDate && { gte: options.startDate }),
              ...(options.endDate && { lte: options.endDate }),
            },
          }
        : {}),
    };

    const [entries, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        include: {
          asset: true,
          chain: true,
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    return { entries, total };
  }

  /**
   * Reconcile balance cache with ledger entries
   */
  async reconcileBalance(userId: string, assetId: string, chainId: string) {
    return this.prisma.executeInTransaction(async (tx) => {
      // Calculate from ledger
      const balance = await this.calculateBalance(tx, userId, assetId, chainId);

      // Get stake positions total
      const stakes = await tx.stakePosition.aggregate({
        where: {
          userId,
          pool: { assetId },
          status: 'ACTIVE',
        },
        _sum: { amount: true },
      });
      const stakedAmount = stakes._sum.amount || new Decimal(0);

      // Get pending withdrawals total
      const withdrawals = await tx.withdrawalRequest.aggregate({
        where: {
          userId,
          assetId,
          status: { in: ['PENDING_REVIEW', 'APPROVED', 'PROCESSING', 'SENT', 'CONFIRMING'] },
        },
        _sum: { amount: true },
      });
      const pendingWithdrawals = withdrawals._sum.amount || new Decimal(0);

      // Get accrued rewards
      const rewards = await tx.stakePosition.aggregate({
        where: {
          userId,
          pool: { assetId },
          status: 'ACTIVE',
        },
        _sum: { rewardsAccrued: true },
      });
      const rewardsAccrued = rewards._sum.rewardsAccrued || new Decimal(0);

      // Calculate available
      const available = balance.minus(stakedAmount).minus(pendingWithdrawals);

      // Update cache
      return tx.balanceCache.upsert({
        where: {
          userId_assetId_chainId: {
            userId,
            assetId,
            chainId,
          },
        },
        create: {
          userId,
          assetId,
          chainId,
          available,
          staked: stakedAmount,
          rewardsAccrued,
          withdrawalsPending: pendingWithdrawals,
        },
        update: {
          available,
          staked: stakedAmount,
          rewardsAccrued,
          withdrawalsPending: pendingWithdrawals,
        },
      });
    });
  }

  /**
   * Full reconciliation check - returns discrepancies
   */
  async checkReconciliation(userId: string) {
    const balances = await this.prisma.balanceCache.findMany({
      where: { userId },
      include: { asset: true, chain: true },
    });

    const discrepancies: Array<{
      assetId: string;
      chainId: string;
      cachedAvailable: string;
      calculatedAvailable: string;
      difference: string;
    }> = [];

    for (const balance of balances) {
      const calculated = await this.prisma.executeInTransaction(async (tx) => {
        return this.calculateBalance(tx, userId, balance.assetId, balance.chainId);
      });

      const stakes = await this.prisma.stakePosition.aggregate({
        where: {
          userId,
          pool: { assetId: balance.assetId },
          status: 'ACTIVE',
        },
        _sum: { amount: true },
      });
      const stakedAmount = stakes._sum.amount || new Decimal(0);

      const withdrawals = await this.prisma.withdrawalRequest.aggregate({
        where: {
          userId,
          assetId: balance.assetId,
          status: { in: ['PENDING_REVIEW', 'APPROVED', 'PROCESSING', 'SENT', 'CONFIRMING'] },
        },
        _sum: { amount: true },
      });
      const pendingWithdrawals = withdrawals._sum.amount || new Decimal(0);

      const calculatedAvailable = calculated.minus(stakedAmount).minus(pendingWithdrawals);

      if (!balance.available.equals(calculatedAvailable)) {
        discrepancies.push({
          assetId: balance.assetId,
          chainId: balance.chainId,
          cachedAvailable: balance.available.toString(),
          calculatedAvailable: calculatedAvailable.toString(),
          difference: balance.available.minus(calculatedAvailable).toString(),
        });
      }
    }

    return discrepancies;
  }
}
