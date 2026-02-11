import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Pool, PoolType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PoolsService {
  constructor(private prisma: PrismaService) {}

  async findAll(options?: { isActive?: boolean; assetId?: string; type?: PoolType }) {
    return this.prisma.pool.findMany({
      where: {
        ...(options?.isActive !== undefined && { isActive: options.isActive }),
        ...(options?.assetId && { assetId: options.assetId }),
        ...(options?.type && { type: options.type }),
      },
      include: {
        asset: {
          include: {
            chain: true,
          },
        },
        _count: {
          select: { stakePositions: { where: { status: 'ACTIVE' } } },
        },
      },
      orderBy: [{ currentApr: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findById(id: string) {
    const pool = await this.prisma.pool.findUnique({
      where: { id },
      include: {
        asset: {
          include: {
            chain: true,
          },
        },
        aprSchedules: {
          orderBy: { effectiveFrom: 'desc' },
          take: 10,
        },
        _count: {
          select: { stakePositions: { where: { status: 'ACTIVE' } } },
        },
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    return pool;
  }

  async getPoolStats(id: string) {
    const pool = await this.findById(id);

    const [activeStakes, totalStakers] = await Promise.all([
      this.prisma.stakePosition.aggregate({
        where: { poolId: id, status: 'ACTIVE' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.stakePosition.groupBy({
        by: ['userId'],
        where: { poolId: id, status: 'ACTIVE' },
      }),
    ]);

    // Calculate capacity utilization
    let capacityUtilization: number | null = null;
    if (pool.totalCapacity) {
      capacityUtilization = pool.totalStaked
        .div(pool.totalCapacity)
        .mul(100)
        .toNumber();
    }

    return {
      pool,
      stats: {
        totalStaked: pool.totalStaked.toString(),
        activePositions: activeStakes._count,
        uniqueStakers: totalStakers.length,
        capacityUtilization,
        remainingCapacity: pool.totalCapacity
          ? pool.totalCapacity.sub(pool.totalStaked).toString()
          : null,
      },
    };
  }

  async calculateEstimatedRewards(
    poolId: string,
    amount: string,
    durationDays: number,
  ) {
    const pool = await this.findById(poolId);
    const amountDecimal = new Decimal(amount);
    
    // APR to daily rate
    const dailyRate = pool.currentApr.div(100).div(365);
    
    // Simple interest calculation
    const rewards = amountDecimal.mul(dailyRate).mul(durationDays);

    return {
      estimatedRewards: rewards.toString(),
      apr: pool.currentApr.toString(),
      durationDays,
      inputAmount: amount,
    };
  }

  async getEffectiveApr(poolId: string, date?: Date) {
    const targetDate = date || new Date();

    const schedule = await this.prisma.aprSchedule.findFirst({
      where: {
        poolId,
        effectiveFrom: { lte: targetDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: targetDate } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (schedule) {
      return schedule.apr;
    }

    // Fallback to pool's current APR
    const pool = await this.prisma.pool.findUnique({
      where: { id: poolId },
      select: { currentApr: true },
    });

    return pool?.currentApr || new Decimal(0);
  }

  async getPublicPools() {
    return this.findAll({ isActive: true });
  }
}
