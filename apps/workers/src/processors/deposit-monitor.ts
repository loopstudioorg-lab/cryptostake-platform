import { Worker, Job } from 'bullmq';
import { PrismaClient, Prisma } from '@prisma/client';
import { ethers, JsonRpcProvider, Contract, formatUnits } from 'ethers';
import IORedis from 'ioredis';
import { QUEUE_NAMES, JOB_TYPES } from '@crypto-stake/shared';
import { Decimal } from '@prisma/client/runtime/library';

const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

interface ScanDepositsData {
  chainId?: string;
}

interface ConfirmDepositData {
  depositId: string;
}

export function createDepositMonitorWorker(
  connection: IORedis,
  prisma: PrismaClient,
): Worker {
  return new Worker(
    QUEUE_NAMES.DEPOSIT_MONITOR,
    async (job: Job) => {
      switch (job.name) {
        case JOB_TYPES.SCAN_DEPOSITS:
          return scanDeposits(prisma, job.data);
        case JOB_TYPES.CONFIRM_DEPOSIT:
          return confirmDeposit(prisma, job.data);
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    },
    {
      connection,
      concurrency: 5,
    },
  );
}

async function scanDeposits(prisma: PrismaClient, data: ScanDepositsData) {
  console.log('[DepositMonitor] Starting deposit scan...');

  const chains = await prisma.chain.findMany({
    where: {
      isActive: true,
      ...(data.chainId && { id: data.chainId }),
    },
  });

  for (const chain of chains) {
    try {
      await scanChainDeposits(prisma, chain);
    } catch (error) {
      console.error(`[DepositMonitor] Error scanning ${chain.name}:`, error);
    }
  }

  console.log('[DepositMonitor] Scan complete');
}

async function scanChainDeposits(
  prisma: PrismaClient,
  chain: Prisma.ChainGetPayload<{}>,
) {
  const provider = new JsonRpcProvider(chain.rpcUrl, {
    chainId: chain.chainId,
    name: chain.name,
  });

  const currentBlock = await provider.getBlockNumber();
  
  // Get last scanned block from system config
  const lastScannedConfig = await prisma.systemConfig.findUnique({
    where: { key: `lastScannedBlock_${chain.id}` },
  });
  
  const lastScannedBlock = lastScannedConfig
    ? (lastScannedConfig.value as any).blockNumber || currentBlock - 1000
    : currentBlock - 1000;

  // Don't scan too far back
  const fromBlock = Math.max(lastScannedBlock + 1, currentBlock - 10000);

  if (fromBlock > currentBlock) {
    console.log(`[DepositMonitor] ${chain.name}: No new blocks to scan`);
    return;
  }

  console.log(`[DepositMonitor] ${chain.name}: Scanning blocks ${fromBlock} to ${currentBlock}`);

  // Get all deposit addresses for this chain
  const depositAddresses = await prisma.depositAddress.findMany({
    where: { chainId: chain.id, isActive: true },
    include: { user: { select: { id: true } } },
  });

  const addressMap = new Map(
    depositAddresses.map(da => [da.address.toLowerCase(), da]),
  );

  // Get all assets for this chain
  const assets = await prisma.asset.findMany({
    where: { chainId: chain.id, isActive: true },
  });

  // Scan ERC-20 transfers
  for (const asset of assets) {
    if (asset.isNative || !asset.contractAddress) continue;

    try {
      const contract = new Contract(asset.contractAddress, ERC20_ABI, provider);
      const filter = contract.filters.Transfer();

      // Query in chunks to avoid RPC limits
      const chunkSize = 2000;
      for (let block = fromBlock; block <= currentBlock; block += chunkSize) {
        const toBlock = Math.min(block + chunkSize - 1, currentBlock);
        
        const events = await contract.queryFilter(filter, block, toBlock);

        for (const event of events) {
          if (!event.args) continue;
          const [from, to, value] = event.args;

          const toAddress = (to as string).toLowerCase();
          const depositAddress = addressMap.get(toAddress);

          if (!depositAddress) continue;

          // Check if already recorded
          const existing = await prisma.deposit.findUnique({
            where: {
              txHash_logIndex_chainId: {
                txHash: event.transactionHash,
                logIndex: event.index,
                chainId: chain.id,
              },
            },
          });

          if (existing) continue;

          // Record new deposit
          const amount = formatUnits(value, asset.decimals);
          
          await prisma.deposit.create({
            data: {
              userId: depositAddress.userId,
              assetId: asset.id,
              chainId: chain.id,
              depositAddressId: depositAddress.id,
              txHash: event.transactionHash,
              logIndex: event.index,
              fromAddress: from as string,
              amount: new Decimal(amount),
              status: 'CONFIRMING',
              confirmations: currentBlock - event.blockNumber,
            },
          });

          console.log(`[DepositMonitor] New deposit: ${amount} ${asset.symbol} to ${toAddress}`);
        }
      }
    } catch (error) {
      console.error(`[DepositMonitor] Error scanning ${asset.symbol}:`, error);
    }
  }

  // Update last scanned block
  await prisma.systemConfig.upsert({
    where: { key: `lastScannedBlock_${chain.id}` },
    create: {
      key: `lastScannedBlock_${chain.id}`,
      value: { blockNumber: currentBlock },
    },
    update: {
      value: { blockNumber: currentBlock },
    },
  });

  // Update confirmations for pending deposits
  const pendingDeposits = await prisma.deposit.findMany({
    where: {
      chainId: chain.id,
      status: 'CONFIRMING',
    },
  });

  for (const deposit of pendingDeposits) {
    try {
      const receipt = await provider.getTransactionReceipt(deposit.txHash);
      if (!receipt) continue;

      const confirmations = currentBlock - receipt.blockNumber + 1;

      if (confirmations >= chain.confirmationsRequired) {
        // Credit user balance
        await prisma.$transaction(async (tx) => {
          await tx.deposit.update({
            where: { id: deposit.id },
            data: {
              confirmations,
              status: 'CONFIRMED',
              confirmedAt: new Date(),
            },
          });

          // Create ledger entry
          await tx.ledgerEntry.create({
            data: {
              userId: deposit.userId,
              assetId: deposit.assetId,
              chainId: deposit.chainId,
              entryType: 'DEPOSIT_CONFIRMED',
              direction: 'CREDIT',
              amount: deposit.amount,
              referenceType: 'Deposit',
              referenceId: deposit.id,
              metadata: {
                txHash: deposit.txHash,
                fromAddress: deposit.fromAddress,
                confirmations,
              },
            },
          });

          // Update balance cache
          await tx.balanceCache.upsert({
            where: {
              userId_assetId_chainId: {
                userId: deposit.userId,
                assetId: deposit.assetId,
                chainId: deposit.chainId,
              },
            },
            create: {
              userId: deposit.userId,
              assetId: deposit.assetId,
              chainId: deposit.chainId,
              available: deposit.amount,
              staked: new Decimal(0),
              rewardsAccrued: new Decimal(0),
              withdrawalsPending: new Decimal(0),
            },
            update: {
              available: { increment: deposit.amount },
            },
          });
        });

        console.log(`[DepositMonitor] Deposit confirmed: ${deposit.id}`);
      } else {
        await prisma.deposit.update({
          where: { id: deposit.id },
          data: { confirmations },
        });
      }
    } catch (error) {
      console.error(`[DepositMonitor] Error updating deposit ${deposit.id}:`, error);
    }
  }
}

async function confirmDeposit(prisma: PrismaClient, data: ConfirmDepositData) {
  // Manual confirmation trigger if needed
  const deposit = await prisma.deposit.findUnique({
    where: { id: data.depositId },
    include: { chain: true },
  });

  if (!deposit || deposit.status === 'CONFIRMED') {
    return;
  }

  // Logic similar to above for single deposit confirmation
  console.log(`[DepositMonitor] Manual confirmation triggered for ${data.depositId}`);
}
