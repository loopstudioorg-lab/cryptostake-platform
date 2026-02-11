import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BalanceService } from '../ledger/balance.service';
import { PoolsService } from '../pools/pools.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class StakesService {
  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
    private poolsService: PoolsService,
  ) {}

  async createStake(userId: string, poolId: string, amount: string) {
    const amountDecimal = new Decimal(amount);

    return this.prisma.executeInTransaction(async (tx) => {
      // Get pool with asset info
      const pool = await tx.pool.findUnique({
        where: { id: poolId },
        include: { asset: true },
      });

      if (!pool) {
        throw new NotFoundException('Pool not found');
      }

      if (!pool.isActive) {
        throw new BadRequestException('Pool is not active');
      }

      // Validate amount
      if (amountDecimal.lessThan(pool.minStake)) {
        throw new BadRequestException(`Minimum stake is ${pool.minStake}`);
      }

      if (pool.maxStake && amountDecimal.greaterThan(pool.maxStake)) {
        throw new BadRequestException(`Maximum stake is ${pool.maxStake}`);
      }

      // Check capacity
      if (pool.totalCapacity) {
        const remaining = pool.totalCapacity.sub(pool.totalStaked);
        if (amountDecimal.greaterThan(remaining)) {
          throw new BadRequestException('Pool capacity exceeded');
        }
      }

      // Calculate lock period
      const lockedUntil = pool.lockDays
        ? new Date(Date.now() + pool.lockDays * 24 * 60 * 60 * 1000)
        : null;

      // Create stake position
      const stakePosition = await tx.stakePosition.create({
        data: {
          userId,
          poolId,
          amount: amountDecimal,
          lockedUntil,
          status: 'ACTIVE',
        },
      });

      // Update pool total staked
      await tx.pool.update({
        where: { id: poolId },
        data: { totalStaked: { increment: amountDecimal } },
      });

      // Update balance via ledger
      await this.balanceService.stakeFromBalance(tx, {
        userId,
        assetId: pool.assetId,
        chainId: pool.asset.chainId,
        amount: amountDecimal,
        stakePositionId: stakePosition.id,
      });

      return stakePosition;
    });
  }

  async getUserStakes(userId: string, status?: string) {
    return this.prisma.stakePosition.findMany({
      where: {
        userId,
        ...(status && { status: status as any }),
      },
      include: {
        pool: {
          include: {
            asset: {
              include: { chain: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStakeById(userId: string, stakeId: string) {
    const stake = await this.prisma.stakePosition.findUnique({
      where: { id: stakeId },
      include: {
        pool: {
          include: {
            asset: {
              include: { chain: true },
            },
          },
        },
      },
    });

    if (!stake) {
      throw new NotFoundException('Stake position not found');
    }

    if (stake.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Calculate current accrued rewards
    const currentRewards = await this.calculateAccruedRewards(stake);

    return {
      ...stake,
      currentAccruedRewards: currentRewards.toString(),
    };
  }

  async unstake(userId: string, stakeId: string) {
    return this.prisma.executeInTransaction(async (tx) => {
      const stake = await tx.stakePosition.findUnique({
        where: { id: stakeId },
        include: {
          pool: {
            include: { asset: true },
          },
        },
      });

      if (!stake) {
        throw new NotFoundException('Stake position not found');
      }

      if (stake.userId !== userId) {
        throw new ForbiddenException('Access denied');
      }

      if (stake.status !== 'ACTIVE') {
        throw new BadRequestException('Stake is not active');
      }

      // Check if locked
      if (stake.lockedUntil && stake.lockedUntil > new Date()) {
        throw new BadRequestException(
          `Stake is locked until ${stake.lockedUntil.toISOString()}`,
        );
      }

      // Check cooldown for flexible pools
      if (stake.pool.cooldownHours > 0 && !stake.cooldownEndsAt) {
        const cooldownEndsAt = new Date(
          Date.now() + stake.pool.cooldownHours * 60 * 60 * 1000,
        );

        await tx.stakePosition.update({
          where: { id: stakeId },
          data: {
            status: 'UNSTAKING',
            unstakeRequestedAt: new Date(),
            cooldownEndsAt,
          },
        });

        return {
          status: 'UNSTAKING',
          cooldownEndsAt,
          message: `Cooldown period of ${stake.pool.cooldownHours} hours started`,
        };
      }

      // Calculate final rewards
      const finalRewards = await this.calculateAccruedRewards(stake);
      const totalAmount = stake.amount.add(finalRewards);

      // Update stake status
      await tx.stakePosition.update({
        where: { id: stakeId },
        data: {
          status: 'COMPLETED',
          unstakedAt: new Date(),
          rewardsAccrued: finalRewards,
        },
      });

      // Update pool total staked
      await tx.pool.update({
        where: { id: stake.poolId },
        data: { totalStaked: { decrement: stake.amount } },
      });

      // Return funds to available balance
      await this.balanceService.unstakeToBalance(tx, {
        userId,
        assetId: stake.pool.assetId,
        chainId: stake.pool.asset.chainId,
        amount: totalAmount,
        stakePositionId: stakeId,
      });

      return {
        status: 'COMPLETED',
        amountReturned: totalAmount.toString(),
        principalReturned: stake.amount.toString(),
        rewardsClaimed: finalRewards.toString(),
      };
    });
  }

  async claimRewards(userId: string, stakeId: string) {
    return this.prisma.executeInTransaction(async (tx) => {
      const stake = await tx.stakePosition.findUnique({
        where: { id: stakeId },
        include: {
          pool: {
            include: { asset: true },
          },
        },
      });

      if (!stake) {
        throw new NotFoundException('Stake position not found');
      }

      if (stake.userId !== userId) {
        throw new ForbiddenException('Access denied');
      }

      if (stake.status !== 'ACTIVE') {
        throw new BadRequestException('Can only claim from active stakes');
      }

      // Calculate accrued rewards
      const accruedRewards = await this.calculateAccruedRewards(stake);

      if (accruedRewards.lessThanOrEqualTo(0)) {
        throw new BadRequestException('No rewards to claim');
      }

      // Update stake position
      await tx.stakePosition.update({
        where: { id: stakeId },
        data: {
          rewardsAccrued: new Decimal(0),
          rewardsClaimed: { increment: accruedRewards },
          lastRewardCalculation: new Date(),
        },
      });

      // Add rewards to available balance
      await this.balanceService.claimRewards(tx, {
        userId,
        assetId: stake.pool.assetId,
        chainId: stake.pool.asset.chainId,
        amount: accruedRewards,
        stakePositionId: stakeId,
      });

      return {
        claimedAmount: accruedRewards.toString(),
        totalClaimed: stake.rewardsClaimed.add(accruedRewards).toString(),
      };
    });
  }

  async calculateAccruedRewards(stake: {
    id: string;
    amount: Decimal;
    poolId: string;
    lastRewardCalculation: Date;
    rewardsAccrued: Decimal;
  }): Promise<Decimal> {
    const now = new Date();
    const timeDiffMs = now.getTime() - stake.lastRewardCalculation.getTime();
    const timeDiffSeconds = timeDiffMs / 1000;

    // Get effective APR
    const apr = await this.poolsService.getEffectiveApr(stake.poolId);

    // Calculate rewards per second
    // APR / 100 / 365 / 24 / 60 / 60 = rate per second
    const ratePerSecond = apr.div(100).div(365).div(24).div(60).div(60);

    const newRewards = stake.amount.mul(ratePerSecond).mul(timeDiffSeconds);

    return stake.rewardsAccrued.add(newRewards);
  }

  async getStakingSummary(userId: string) {
    const activeStakes = await this.prisma.stakePosition.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        pool: {
          include: {
            asset: { include: { chain: true } },
          },
        },
      },
    });

    let totalStaked = new Decimal(0);
    let totalRewardsAccrued = new Decimal(0);

    for (const stake of activeStakes) {
      totalStaked = totalStaked.add(stake.amount);
      const rewards = await this.calculateAccruedRewards(stake);
      totalRewardsAccrued = totalRewardsAccrued.add(rewards);
    }

    const totalClaimed = await this.prisma.stakePosition.aggregate({
      where: { userId },
      _sum: { rewardsClaimed: true },
    });

    return {
      activeStakesCount: activeStakes.length,
      totalStaked: totalStaked.toString(),
      totalRewardsAccrued: totalRewardsAccrued.toString(),
      totalRewardsClaimed: (totalClaimed._sum.rewardsClaimed || new Decimal(0)).toString(),
      activeStakes,
    };
  }
}
