import 'dotenv/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { QUEUE_NAMES, JOB_TYPES } from '@crypto-stake/shared';

import { createDepositMonitorWorker } from './processors/deposit-monitor';
import { createPayoutProcessorWorker } from './processors/payout-processor';
import { createRewardCalculatorWorker } from './processors/reward-calculator';

const prisma = new PrismaClient();

const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

const workers: Worker[] = [];

async function main() {
  console.log('🚀 Starting workers...');

  // Deposit Monitor Worker
  const depositWorker = createDepositMonitorWorker(redisConnection, prisma);
  workers.push(depositWorker);
  console.log(`✅ ${QUEUE_NAMES.DEPOSIT_MONITOR} worker started`);

  // Payout Processor Worker
  const payoutWorker = createPayoutProcessorWorker(redisConnection, prisma);
  workers.push(payoutWorker);
  console.log(`✅ ${QUEUE_NAMES.PAYOUT_PROCESSOR} worker started`);

  // Reward Calculator Worker
  const rewardWorker = createRewardCalculatorWorker(redisConnection, prisma);
  workers.push(rewardWorker);
  console.log(`✅ ${QUEUE_NAMES.REWARD_CALCULATOR} worker started`);

  console.log('🎉 All workers running');

  // Schedule recurring jobs
  await scheduleRecurringJobs();
}

async function scheduleRecurringJobs() {
  const { Queue } = await import('bullmq');

  // Deposit scanning - every 30 seconds
  const depositQueue = new Queue(QUEUE_NAMES.DEPOSIT_MONITOR, {
    connection: redisConnection,
  });

  await depositQueue.add(
    JOB_TYPES.SCAN_DEPOSITS,
    {},
    {
      repeat: {
        every: 30000, // 30 seconds
      },
      removeOnComplete: 100,
      removeOnFail: 1000,
    },
  );

  // Reward calculation - every minute
  const rewardQueue = new Queue(QUEUE_NAMES.REWARD_CALCULATOR, {
    connection: redisConnection,
  });

  await rewardQueue.add(
    JOB_TYPES.CALCULATE_REWARDS,
    {},
    {
      repeat: {
        every: 60000, // 1 minute
      },
      removeOnComplete: 100,
      removeOnFail: 1000,
    },
  );

  console.log('📅 Recurring jobs scheduled');
}

// Graceful shutdown
async function shutdown() {
  console.log('🛑 Shutting down workers...');

  for (const worker of workers) {
    await worker.close();
  }

  await prisma.$disconnect();
  await redisConnection.quit();

  console.log('👋 Workers shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
