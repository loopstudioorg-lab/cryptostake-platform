import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { Prisma, LedgerEntryType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class BalanceService {
  constructor(
    private prisma: PrismaService,
    private ledgerService: LedgerService,
  ) {}

  /**
   * Get user's balance for a specific asset
   */
  async getBalance(userId: string, assetId: string, chainId: string) {
    const balance = await this.prisma.balanceCache.findUnique({
      where: {
        userId_assetId_chainId: {
          userId,
          assetId,
          chainId,
        },
      },
    });

    return balance || {
      available: new Decimal(0),
      staked: new Decimal(0),
      rewardsAccrued: new Decimal(0),
      withdrawalsPending: new Decimal(0),
    };
  }

  /**
   * Get all balances for a user
   */
  async getAllBalances(userId: string) {
    return this.prisma.balanceCache.findMany({
      where: { userId },
      include: {
        asset: true,
        chain: true,
      },
    });
  }

  /**
   * Credit user balance (e.g., deposit confirmed)
   */
  async creditBalance(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      assetId: string;
      chainId: string;
      amount: Decimal | string;
      entryType: LedgerEntryType;
      referenceType: string;
      referenceId: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const amount = typeof params.amount === 'string' 
      ? new Decimal(params.amount) 
      : params.amount;

    // Create ledger entry
    await this.ledgerService.createEntry(tx, {
      userId: params.userId,
      assetId: params.assetId,
      chainId: params.chainId,
      entryType: params.entryType,
      direction: 'CREDIT',
      amount,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      metadata: params.metadata,
    });

    // Update balance cache
    await tx.balanceCache.upsert({
      where: {
        userId_assetId_chainId: {
          userId: params.userId,
          assetId: params.assetId,
          chainId: params.chainId,
        },
      },
      create: {
        userId: params.userId,
        assetId: params.assetId,
        chainId: params.chainId,
        available: amount,
        staked: new Decimal(0),
        rewardsAccrued: new Decimal(0),
        withdrawalsPending: new Decimal(0),
      },
      update: {
        available: { increment: amount },
      },
    });
  }

  /**
   * Reserve funds for withdrawal request
   */
  async reserveForWithdrawal(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      assetId: string;
      chainId: string;
      amount: Decimal | string;
      withdrawalRequestId: string;
    },
  ) {
    const amount = typeof params.amount === 'string' 
      ? new Decimal(params.amount) 
      : params.amount;

    // Check available balance
    const balance = await tx.balanceCache.findUnique({
      where: {
        userId_assetId_chainId: {
          userId: params.userId,
          assetId: params.assetId,
          chainId: params.chainId,
        },
      },
    });

    if (!balance || balance.available.lessThan(amount)) {
      throw new BadRequestException('Insufficient available balance');
    }

    // Create ledger entry
    await this.ledgerService.createEntry(tx, {
      userId: params.userId,
      assetId: params.assetId,
      chainId: params.chainId,
      entryType: 'WITHDRAWAL_REQUESTED',
      direction: 'DEBIT',
      amount,
      referenceType: 'WithdrawalRequest',
      referenceId: params.withdrawalRequestId,
    });

    // Update balance cache - move from available to pending
    await tx.balanceCache.update({
      where: {
        userId_assetId_chainId: {
          userId: params.userId,
          assetId: params.assetId,
          chainId: params.chainId,
        },
      },
      data: {
        available: { decrement: amount },
        withdrawalsPending: { increment: amount },
      },
    });
  }

  /**
   * Release reserved funds on withdrawal rejection
   */
  async releaseReservedFunds(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      assetId: string;
      chainId: string;
      amount: Decimal | string;
      withdrawalRequestId: string;
    },
  ) {
    const amount = typeof params.amount === 'string' 
      ? new Decimal(params.amount) 
      : params.amount;

    // Create ledger entry (credit back)
    await this.ledgerService.createEntry(tx, {
      userId: params.userId,
      assetId: params.assetId,
      chainId: params.chainId,
      entryType: 'WITHDRAWAL_REJECTED',
      direction: 'CREDIT',
      amount,
      referenceType: 'WithdrawalRequest',
      referenceId: params.withdrawalRequestId,
    });

    // Update balance cache - move from pending back to available
    await tx.balanceCache.update({
      where: {
        userId_assetId_chainId: {
          userId: params.userId,
          assetId: params.assetId,
          chainId: params.chainId,
        },
      },
      data: {
        available: { increment: amount },
        withdrawalsPending: { decrement: amount },
      },
    });
  }

  /**
   * Finalize withdrawal (remove from pending on successful payout)
   */
  async finalizeWithdrawal(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      assetId: string;
      chainId: string;
      amount: Decimal | string;
      withdrawalRequestId: string;
      txHash?: string;
    },
  ) {
    const amount = typeof params.amount === 'string' 
      ? new Decimal(params.amount) 
      : params.amount;

    // Create ledger entry for payout
    await this.ledgerService.createEntry(tx, {
      userId: params.userId,
      assetId: params.assetId,
      chainId: params.chainId,
      entryType: 'WITHDRAWAL_PAID',
      direction: 'DEBIT',
      amount: new Decimal(0), // Already debited during reserve
      referenceType: 'WithdrawalRequest',
      referenceId: params.withdrawalRequestId,
      metadata: { txHash: params.txHash },
    });

    // Update balance cache - clear pending
    await tx.balanceCache.update({
      where: {
        userId_assetId_chainId: {
          userId: params.userId,
          assetId: params.assetId,
          chainId: params.chainId,
        },
      },
      data: {
        withdrawalsPending: { decrement: amount },
      },
    });
  }

  /**
   * Stake from available balance
   */
  async stakeFromBalance(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      assetId: string;
      chainId: string;
      amount: Decimal | string;
      stakePositionId: string;
    },
  ) {
    const amount = typeof params.amount === 'string' 
      ? new Decimal(params.amount) 
      : params.amount;

    // Check available balance
    const balance = await tx.balanceCache.findUnique({
      where: {
        userId_assetId_chainId: {
          userId: params.userId,
          assetId: params.assetId,
          chainId: params.chainId,
        },
      },
    });

    if (!balance || balance.available.lessThan(amount)) {
      throw new BadRequestException('Insufficient available balance');
    }

    // Create ledger entry
    await this.ledgerService.createEntry(tx, {
      userId: params.userId,
      assetId: params.assetId,
      chainId: params.chainId,
      entryType: 'STAKE_CREATED',
      direction: 'DEBIT',
      amount,
      referenceType: 'StakePosition',
      referenceId: params.stakePositionId,
    });

    // Update balance cache
    await tx.balanceCache.update({
      where: {
        userId_assetId_chainId: {
          userId: params.userId,
          assetId: params.assetId,
          chainId: params.chainId,
        },
      },
      data: {
        available: { decrement: amount },
        staked: { increment: amount },
      },
    });
  }

  /**
   * Unstake to available balance
   */
  async unstakeToBalance(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      assetId: string;
      chainId: string;
      amount: Decimal | string;
      stakePositionId: string;
    },
  ) {
    const amount = typeof params.amount === 'string' 
      ? new Decimal(params.amount) 
      : params.amount;

    // Create ledger entry
    await this.ledgerService.createEntry(tx, {
      userId: params.userId,
      assetId: params.assetId,
      chainId: params.chainId,
      entryType: 'UNSTAKE_COMPLETED',
      direction: 'CREDIT',
      amount,
      referenceType: 'StakePosition',
      referenceId: params.stakePositionId,
    });

    // Update balance cache
    await tx.balanceCache.update({
      where: {
        userId_assetId_chainId: {
          userId: params.userId,
          assetId: params.assetId,
          chainId: params.chainId,
        },
      },
      data: {
        available: { increment: amount },
        staked: { decrement: amount },
      },
    });
  }

  /**
   * Claim rewards to available balance
   */
  async claimRewards(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      assetId: string;
      chainId: string;
      amount: Decimal | string;
      stakePositionId: string;
    },
  ) {
    const amount = typeof params.amount === 'string' 
      ? new Decimal(params.amount) 
      : params.amount;

    // Create ledger entry
    await this.ledgerService.createEntry(tx, {
      userId: params.userId,
      assetId: params.assetId,
      chainId: params.chainId,
      entryType: 'REWARD_CLAIMED',
      direction: 'CREDIT',
      amount,
      referenceType: 'StakePosition',
      referenceId: params.stakePositionId,
    });

    // Update balance cache
    await tx.balanceCache.update({
      where: {
        userId_assetId_chainId: {
          userId: params.userId,
          assetId: params.assetId,
          chainId: params.chainId,
        },
      },
      data: {
        available: { increment: amount },
        rewardsAccrued: { decrement: amount },
      },
    });
  }

  /**
   * Accrue rewards (update rewards without moving to available)
   */
  async accrueRewards(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      assetId: string;
      chainId: string;
      amount: Decimal | string;
      stakePositionId: string;
    },
  ) {
    const amount = typeof params.amount === 'string' 
      ? new Decimal(params.amount) 
      : params.amount;

    // Create ledger entry
    await this.ledgerService.createEntry(tx, {
      userId: params.userId,
      assetId: params.assetId,
      chainId: params.chainId,
      entryType: 'REWARD_ACCRUED',
      direction: 'CREDIT',
      amount,
      referenceType: 'StakePosition',
      referenceId: params.stakePositionId,
    });

    // Update balance cache
    await tx.balanceCache.upsert({
      where: {
        userId_assetId_chainId: {
          userId: params.userId,
          assetId: params.assetId,
          chainId: params.chainId,
        },
      },
      create: {
        userId: params.userId,
        assetId: params.assetId,
        chainId: params.chainId,
        available: new Decimal(0),
        staked: new Decimal(0),
        rewardsAccrued: amount,
        withdrawalsPending: new Decimal(0),
      },
      update: {
        rewardsAccrued: { increment: amount },
      },
    });
  }
}
