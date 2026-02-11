import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { ethers, JsonRpcProvider, Wallet, Contract, parseUnits } from 'ethers';
import IORedis from 'ioredis';
import { QUEUE_NAMES, JOB_TYPES } from '@crypto-stake/shared';
import { Decimal } from '@prisma/client/runtime/library';
import { createCipheriv, createDecipheriv, scryptSync } from 'crypto';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
];

interface ProcessPayoutData {
  withdrawalRequestId: string;
}

interface CheckPayoutStatusData {
  payoutTxId: string;
}

// Encryption helpers for treasury wallet private keys
function decryptPrivateKey(encryptedKey: string, masterKey: string): string {
  const key = scryptSync(masterKey, 'crypto-stake-salt', 32);
  const parts = encryptedKey.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted key format');
  }

  const [ivHex, tagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function createPayoutProcessorWorker(
  connection: IORedis,
  prisma: PrismaClient,
): Worker {
  return new Worker(
    QUEUE_NAMES.PAYOUT_PROCESSOR,
    async (job: Job) => {
      switch (job.name) {
        case JOB_TYPES.PROCESS_PAYOUT:
          return processPayout(prisma, job.data);
        case JOB_TYPES.CHECK_PAYOUT_STATUS:
          return checkPayoutStatus(prisma, job.data);
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    },
    {
      connection,
      concurrency: 1, // Process payouts one at a time for nonce management
    },
  );
}

async function processPayout(prisma: PrismaClient, data: ProcessPayoutData) {
  const { withdrawalRequestId } = data;
  console.log(`[PayoutProcessor] Processing payout for request ${withdrawalRequestId}`);

  const request = await prisma.withdrawalRequest.findUnique({
    where: { id: withdrawalRequestId },
    include: {
      user: true,
      asset: true,
      chain: true,
    },
  });

  if (!request) {
    throw new Error(`Withdrawal request not found: ${withdrawalRequestId}`);
  }

  if (request.status !== 'APPROVED') {
    console.log(`[PayoutProcessor] Request ${withdrawalRequestId} not in APPROVED status, skipping`);
    return;
  }

  // Update status to processing
  await prisma.withdrawalRequest.update({
    where: { id: withdrawalRequestId },
    data: { status: 'PROCESSING' },
  });

  try {
    // Get treasury wallet for this chain
    const treasuryWallet = await prisma.treasuryWallet.findFirst({
      where: {
        chainId: request.chainId,
        isActive: true,
        isHotWallet: true,
      },
    });

    if (!treasuryWallet) {
      throw new Error(`No active treasury wallet for chain ${request.chain.name}`);
    }

    if (!treasuryWallet.encryptedPrivateKey) {
      throw new Error('Treasury wallet private key not configured');
    }

    // Decrypt private key
    const masterKey = process.env.MASTER_KEY;
    if (!masterKey) {
      throw new Error('MASTER_KEY not configured');
    }

    const privateKey = decryptPrivateKey(treasuryWallet.encryptedPrivateKey, masterKey);

    // Connect to chain
    const provider = new JsonRpcProvider(request.chain.rpcUrl, {
      chainId: request.chain.chainId,
      name: request.chain.name,
    });

    const wallet = new Wallet(privateKey, provider);

    let txHash: string;
    let nonce: number;

    if (request.asset.isNative) {
      // Send native token (ETH, BNB, MATIC)
      const tx = await wallet.sendTransaction({
        to: request.destinationAddress,
        value: parseUnits(request.netAmount.toString(), 18),
      });

      txHash = tx.hash;
      nonce = tx.nonce;
    } else {
      // Send ERC-20 token
      if (!request.asset.contractAddress) {
        throw new Error('Asset contract address not configured');
      }

      const contract = new Contract(
        request.asset.contractAddress,
        ERC20_ABI,
        wallet,
      );

      const amount = parseUnits(
        request.netAmount.toString(),
        request.asset.decimals,
      );

      const tx = await contract.transfer(request.destinationAddress, amount);

      txHash = tx.hash;
      nonce = tx.nonce;
    }

    // Create payout tx record
    await prisma.payoutTx.create({
      data: {
        withdrawalRequestId,
        txHash,
        nonce,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    // Update withdrawal request status
    await prisma.withdrawalRequest.update({
      where: { id: withdrawalRequestId },
      data: { status: 'SENT' },
    });

    console.log(`[PayoutProcessor] Payout sent: ${txHash}`);

    // Schedule status check
    const { Queue } = await import('bullmq');
    const queue = new Queue(QUEUE_NAMES.PAYOUT_PROCESSOR, {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
      },
    });

    await queue.add(
      JOB_TYPES.CHECK_PAYOUT_STATUS,
      { payoutTxId: txHash },
      {
        delay: 30000, // Check after 30 seconds
        attempts: 20,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
      },
    );

    return { txHash };

  } catch (error: any) {
    console.error(`[PayoutProcessor] Error processing payout:`, error);

    // Record error
    await prisma.payoutTx.upsert({
      where: { withdrawalRequestId },
      create: {
        withdrawalRequestId,
        status: 'FAILED',
        errorMessage: error.message,
        attempts: 1,
      },
      update: {
        status: 'FAILED',
        errorMessage: error.message,
        attempts: { increment: 1 },
      },
    });

    await prisma.withdrawalRequest.update({
      where: { id: withdrawalRequestId },
      data: { status: 'FAILED' },
    });

    throw error;
  }
}

async function checkPayoutStatus(prisma: PrismaClient, data: CheckPayoutStatusData) {
  const { payoutTxId } = data;
  console.log(`[PayoutProcessor] Checking status for tx ${payoutTxId}`);

  const payoutTx = await prisma.payoutTx.findFirst({
    where: { txHash: payoutTxId },
    include: {
      withdrawalRequest: {
        include: {
          chain: true,
          asset: true,
          user: true,
        },
      },
    },
  });

  if (!payoutTx) {
    throw new Error(`Payout tx not found: ${payoutTxId}`);
  }

  if (payoutTx.status === 'CONFIRMED' || payoutTx.status === 'FAILED') {
    console.log(`[PayoutProcessor] Tx ${payoutTxId} already in final state`);
    return;
  }

  const chain = payoutTx.withdrawalRequest.chain;
  const provider = new JsonRpcProvider(chain.rpcUrl, {
    chainId: chain.chainId,
    name: chain.name,
  });

  const receipt = await provider.getTransactionReceipt(payoutTx.txHash!);

  if (!receipt) {
    console.log(`[PayoutProcessor] Tx ${payoutTxId} not yet mined`);
    // Will retry via job backoff
    throw new Error('Transaction not yet mined');
  }

  const currentBlock = await provider.getBlockNumber();
  const confirmations = currentBlock - receipt.blockNumber + 1;

  if (receipt.status === 0) {
    // Transaction failed on-chain
    await prisma.$transaction([
      prisma.payoutTx.update({
        where: { id: payoutTx.id },
        data: {
          status: 'FAILED',
          confirmations,
          errorMessage: 'Transaction reverted on-chain',
        },
      }),
      prisma.withdrawalRequest.update({
        where: { id: payoutTx.withdrawalRequestId },
        data: { status: 'FAILED' },
      }),
    ]);

    console.log(`[PayoutProcessor] Tx ${payoutTxId} failed on-chain`);
    return;
  }

  if (confirmations >= chain.confirmationsRequired) {
    // Transaction confirmed
    await prisma.$transaction(async (tx: PrismaClient) => {
      await tx.payoutTx.update({
        where: { id: payoutTx.id },
        data: {
          status: 'CONFIRMED',
          confirmations,
          gasUsed: receipt.gasUsed,
          confirmedAt: new Date(),
        },
      });

      await tx.withdrawalRequest.update({
        where: { id: payoutTx.withdrawalRequestId },
        data: { status: 'COMPLETED' },
      });

      // Finalize balance (clear pending)
      await tx.balanceCache.update({
        where: {
          userId_assetId_chainId: {
            userId: payoutTx.withdrawalRequest.userId,
            assetId: payoutTx.withdrawalRequest.assetId,
            chainId: payoutTx.withdrawalRequest.chainId,
          },
        },
        data: {
          withdrawalsPending: {
            decrement: payoutTx.withdrawalRequest.amount,
          },
        },
      });

      // Create notification
      await tx.notification.create({
        data: {
          userId: payoutTx.withdrawalRequest.userId,
          type: 'withdrawal_completed',
          title: 'Withdrawal Completed',
          message: `Your withdrawal of ${payoutTx.withdrawalRequest.netAmount} ${payoutTx.withdrawalRequest.asset.symbol} has been completed.`,
          data: {
            txHash: payoutTx.txHash,
            withdrawalRequestId: payoutTx.withdrawalRequestId,
          },
        },
      });
    });

    console.log(`[PayoutProcessor] Tx ${payoutTxId} confirmed with ${confirmations} confirmations`);
  } else {
    // Still confirming
    await prisma.payoutTx.update({
      where: { id: payoutTx.id },
      data: {
        status: 'CONFIRMING',
        confirmations,
      },
    });

    await prisma.withdrawalRequest.update({
      where: { id: payoutTx.withdrawalRequestId },
      data: { status: 'CONFIRMING' },
    });

    console.log(`[PayoutProcessor] Tx ${payoutTxId} has ${confirmations}/${chain.confirmationsRequired} confirmations`);

    // Throw to trigger retry
    throw new Error(`Waiting for confirmations: ${confirmations}/${chain.confirmationsRequired}`);
  }
}
