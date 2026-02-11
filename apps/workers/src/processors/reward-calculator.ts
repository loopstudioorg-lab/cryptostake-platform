import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';
import { QUEUE_NAMES, JOB_TYPES } from '@crypto-stake/shared';
import { Decimal } from '@prisma/client/runtime/library';

export function createRewardCalculatorWorker(
  connection: IORedis,
  prisma: PrismaClient,
): Worker {
  return new Worker(
    QUEUE_NAMES.REWARD_CALCULATOR,
    async (job: Job) => {
      switch (job.name) {
        case JOB_TYPES.CALCULATE_REWARDS:
          return calculateRewards(prisma);
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    },
    {
      connection,
      concurrency: 1,
    },
  );
}

async function calculateRewards(prisma: PrismaClient) {
  console.log('[RewardCalculator] Starting reward calculation...');

  const now = new Date();

  // Get all active stake positions
  const activeStakes = await prisma.stakePosition.findMany({
    where: { status: 'ACTIVE' },
    include: {
      pool: {
        include: {
          asset: true,
        },
      },
      user: {
        select: { id: true },
      },
    },
  });

  console.log(`[RewardCalculator] Processing ${activeStakes.length} active stakes`);

  let totalRewardsAccrued = new Decimal(0);
  let stakesProcessed = 0;

  for (const stake of activeStakes) {
    try {
      // Calculate time since last calculation
      const timeDiffMs = now.getTime() - stake.lastRewardCalculation.getTime();
      const timeDiffSeconds = timeDiffMs / 1000;

      // Skip if less than 1 second has passed
      if (timeDiffSeconds < 1) continue;

      // Get effective APR (could be from schedule)
      const effectiveApr = await getEffectiveApr(prisma, stake.poolId, now);

      // Calculate rewards per second
      // APR / 100 / 365 / 24 / 60 / 60 = rate per second
      const ratePerSecond = effectiveApr.div(100).div(365).div(24).div(60).div(60);

      // Calculate new rewards
      const newRewards = stake.amount.mul(ratePerSecond).mul(timeDiffSeconds);

      if (newRewards.greaterThan(0)) {
        await prisma.$transaction(async (tx) => {
          // Update stake position
          await tx.stakePosition.update({
            where: { id: stake.id },
            data: {
              rewardsAccrued: { increment: newRewards },
              lastRewardCalculation: now,
            },
          });

          // Update balance cache
          await tx.balanceCache.upsert({
            where: {
              userId_assetId_chainId: {
                userId: stake.userId,
                assetId: stake.pool.assetId,
                chainId: stake.pool.asset.chainId,
              },
            },
            create: {
              userId: stake.userId,
              assetId: stake.pool.assetId,
              chainId: stake.pool.asset.chainId,
              available: new Decimal(0),
              staked: stake.amount,
              rewardsAccrued: newRewards,
              withdrawalsPending: new Decimal(0),
            },
            update: {
              rewardsAccrued: { increment: newRewards },
            },
          });

          // Create ledger entry for accrued rewards
          await tx.ledgerEntry.create({
            data: {
              userId: stake.userId,
              assetId: stake.pool.assetId,
              chainId: stake.pool.asset.chainId,
              entryType: 'REWARD_ACCRUED',
              direction: 'CREDIT',
              amount: newRewards,
              referenceType: 'StakePosition',
              referenceId: stake.id,
              metadata: {
                apr: effectiveApr.toString(),
                timePeriodSeconds: timeDiffSeconds,
              },
            },
          });
        });

        totalRewardsAccrued = totalRewardsAccrued.add(newRewards);
        stakesProcessed++;
      }
    } catch (error) {
      console.error(`[RewardCalculator] Error processing stake ${stake.id}:`, error);
    }
  }

  // Process cooldown completions for unstaking positions
  await processUnstakingPositions(prisma, now);

  console.log(
    `[RewardCalculator] Complete. Processed ${stakesProcessed} stakes, ` +
    `accrued ${totalRewardsAccrued.toFixed(8)} total rewards`,
  );

  return {
    stakesProcessed,
    totalRewardsAccrued: totalRewardsAccrued.toString(),
  };
}

async function getEffectiveApr(
  prisma: PrismaClient,
  poolId: string,
  date: Date,
): Promise<Decimal> {
  // Check for scheduled APR
  const schedule = await prisma.aprSchedule.findFirst({
    where: {
      poolId,
      effectiveFrom: { lte: date },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: date } },
      ],
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  if (schedule) {
    return schedule.apr;
  }

  // Fallback to pool's current APR
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { currentApr: true },
  });

  return pool?.currentApr || new Decimal(0);
}

async function processUnstakingPositions(prisma: PrismaClient, now: Date) {
  // Find positions that have completed their cooldown
  const completedCooldowns = await prisma.stakePosition.findMany({
    where: {
      status: 'UNSTAKING',
      cooldownEndsAt: { lte: now },
    },
    include: {
      pool: {
        include: { asset: true },
      },
    },
  });

  for (const stake of completedCooldowns) {
    try {
      await prisma.$transaction(async (tx) => {
        // Calculate final rewards
        const timeDiffMs = now.getTime() - stake.lastRewardCalculation.getTime();
        const timeDiffSeconds = timeDiffMs / 1000;
        const effectiveApr = await getEffectiveApr(prisma, stake.poolId, now);
        const ratePerSecond = effectiveApr.div(100).div(365).div(24).div(60).div(60);
        const finalRewards = stake.amount.mul(ratePerSecond).mul(timeDiffSeconds);
        
        const totalRewards = stake.rewardsAccrued.add(finalRewards);
        const totalAmount = stake.amount.add(totalRewards);

        // Complete the stake
        await tx.stakePosition.update({
          where: { id: stake.id },
          data: {
            status: 'COMPLETED',
            unstakedAt: now,
            rewardsAccrued: totalRewards,
          },
        });

        // Update pool total staked
        await tx.pool.update({
          where: { id: stake.poolId },
          data: {
            totalStaked: { decrement: stake.amount },
          },
        });

        // Return funds to available balance
        await tx.balanceCache.update({
          where: {
            userId_assetId_chainId: {
              userId: stake.userId,
              assetId: stake.pool.assetId,
              chainId: stake.pool.asset.chainId,
            },
          },
          data: {
            available: { increment: totalAmount },
            staked: { decrement: stake.amount },
            rewardsAccrued: { decrement: stake.rewardsAccrued },
          },
        });

        // Create ledger entry
        await tx.ledgerEntry.create({
          data: {
            userId: stake.userId,
            assetId: stake.pool.assetId,
            chainId: stake.pool.asset.chainId,
            entryType: 'UNSTAKE_COMPLETED',
            direction: 'CREDIT',
            amount: totalAmount,
            referenceType: 'StakePosition',
            referenceId: stake.id,
            metadata: {
              principal: stake.amount.toString(),
              rewards: totalRewards.toString(),
            },
          },
        });

        // Create notification
        await tx.notification.create({
          data: {
            userId: stake.userId,
            type: 'stake_completed',
            title: 'Unstake Complete',
            message: `Your stake of ${stake.amount} ${stake.pool.asset.symbol} has been unstaked. Rewards: ${totalRewards.toFixed(8)} ${stake.pool.asset.symbol}`,
            data: {
              stakePositionId: stake.id,
              principal: stake.amount.toString(),
              rewards: totalRewards.toString(),
            },
          },
        });

        console.log(`[RewardCalculator] Completed unstaking for position ${stake.id}`);
      });
    } catch (error) {
      console.error(`[RewardCalculator] Error completing unstake ${stake.id}:`, error);
    }
  }
}
