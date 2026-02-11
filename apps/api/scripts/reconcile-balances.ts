/**
 * Balance Reconciliation Script
 * 
 * This script verifies that cached balances match the ledger entries.
 * Run periodically to ensure data integrity.
 * 
 * Usage: npx ts-node scripts/reconcile-balances.ts [--fix]
 */

import { PrismaClient, LedgerEntryType, LedgerEntryDirection } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

interface ReconciliationResult {
  userId: string;
  assetId: string;
  chainId: string;
  field: string;
  cached: string;
  calculated: string;
  difference: string;
}

async function calculateBalanceFromLedger(
  userId: string,
  assetId: string,
  chainId: string
): Promise<{
  available: Decimal;
  staked: Decimal;
  rewardsAccrued: Decimal;
  withdrawalsPending: Decimal;
}> {
  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: { userId, assetId, chainId },
    orderBy: { createdAt: 'asc' },
  });

  let available = new Decimal(0);
  let staked = new Decimal(0);
  let rewardsAccrued = new Decimal(0);
  let withdrawalsPending = new Decimal(0);

  for (const entry of ledgerEntries) {
    const amount = new Decimal(entry.amount);
    const isCredit = entry.direction === LedgerEntryDirection.CREDIT;

    switch (entry.entryType) {
      case LedgerEntryType.DEPOSIT_CONFIRMED:
        if (isCredit) available = available.add(amount);
        break;

      case LedgerEntryType.STAKE_CREATED:
        if (!isCredit) {
          available = available.sub(amount);
          staked = staked.add(amount);
        }
        break;

      case LedgerEntryType.UNSTAKE_COMPLETED:
        if (isCredit) {
          staked = staked.sub(amount);
          available = available.add(amount);
        }
        break;

      case LedgerEntryType.REWARD_ACCRUED:
        if (isCredit) rewardsAccrued = rewardsAccrued.add(amount);
        break;

      case LedgerEntryType.REWARD_CLAIMED:
        if (isCredit) {
          rewardsAccrued = rewardsAccrued.sub(amount);
          available = available.add(amount);
        }
        break;

      case LedgerEntryType.WITHDRAWAL_REQUESTED:
        if (!isCredit) {
          available = available.sub(amount);
          withdrawalsPending = withdrawalsPending.add(amount);
        }
        break;

      case LedgerEntryType.WITHDRAWAL_REJECTED:
        if (isCredit) {
          withdrawalsPending = withdrawalsPending.sub(amount);
          available = available.add(amount);
        }
        break;

      case LedgerEntryType.WITHDRAWAL_PAID:
        if (!isCredit) {
          withdrawalsPending = withdrawalsPending.sub(amount);
        }
        break;

      case LedgerEntryType.ADJUSTMENT:
        if (isCredit) available = available.add(amount);
        else available = available.sub(amount);
        break;
    }
  }

  return { available, staked, rewardsAccrued, withdrawalsPending };
}

async function reconcile(fix: boolean = false): Promise<ReconciliationResult[]> {
  console.log('🔍 Starting balance reconciliation...\n');

  const balanceCaches = await prisma.balanceCache.findMany({
    include: {
      user: { select: { email: true } },
      asset: { select: { symbol: true } },
      chain: { select: { name: true } },
    },
  });

  const discrepancies: ReconciliationResult[] = [];

  for (const cache of balanceCaches) {
    const calculated = await calculateBalanceFromLedger(
      cache.userId,
      cache.assetId,
      cache.chainId
    );

    const fields: Array<{ name: string; cached: Decimal; calc: Decimal }> = [
      { name: 'available', cached: cache.available, calc: calculated.available },
      { name: 'staked', cached: cache.staked, calc: calculated.staked },
      { name: 'rewardsAccrued', cached: cache.rewardsAccrued, calc: calculated.rewardsAccrued },
      { name: 'withdrawalsPending', cached: cache.withdrawalsPending, calc: calculated.withdrawalsPending },
    ];

    for (const field of fields) {
      if (!field.cached.equals(field.calc)) {
        discrepancies.push({
          userId: cache.userId,
          assetId: cache.assetId,
          chainId: cache.chainId,
          field: field.name,
          cached: field.cached.toString(),
          calculated: field.calc.toString(),
          difference: field.cached.sub(field.calc).toString(),
        });

        console.log(
          `❌ Discrepancy found for ${cache.user.email} - ${cache.asset.symbol} on ${cache.chain.name}:`
        );
        console.log(`   ${field.name}: cached=${field.cached}, calculated=${field.calc}`);
        console.log(`   Difference: ${field.cached.sub(field.calc)}\n`);
      }
    }

    if (fix && discrepancies.length > 0) {
      await prisma.balanceCache.update({
        where: { id: cache.id },
        data: {
          available: calculated.available,
          staked: calculated.staked,
          rewardsAccrued: calculated.rewardsAccrued,
          withdrawalsPending: calculated.withdrawalsPending,
        },
      });
      console.log(`   ✓ Fixed balance cache for ${cache.user.email}\n`);
    }
  }

  // Check for users with ledger entries but no balance cache
  const usersWithLedger = await prisma.ledgerEntry.findMany({
    where: { userId: { not: null } },
    distinct: ['userId', 'assetId', 'chainId'],
    select: { userId: true, assetId: true, chainId: true },
  });

  for (const entry of usersWithLedger) {
    if (!entry.userId) continue;

    const hasCache = await prisma.balanceCache.findUnique({
      where: {
        userId_assetId_chainId: {
          userId: entry.userId,
          assetId: entry.assetId,
          chainId: entry.chainId,
        },
      },
    });

    if (!hasCache) {
      console.log(
        `⚠️  Missing balance cache for user ${entry.userId}, asset ${entry.assetId}, chain ${entry.chainId}`
      );

      if (fix) {
        const calculated = await calculateBalanceFromLedger(
          entry.userId,
          entry.assetId,
          entry.chainId
        );

        await prisma.balanceCache.create({
          data: {
            userId: entry.userId,
            assetId: entry.assetId,
            chainId: entry.chainId,
            available: calculated.available,
            staked: calculated.staked,
            rewardsAccrued: calculated.rewardsAccrued,
            withdrawalsPending: calculated.withdrawalsPending,
          },
        });
        console.log(`   ✓ Created missing balance cache\n`);
      }
    }
  }

  return discrepancies;
}

async function main() {
  const fix = process.argv.includes('--fix');

  if (fix) {
    console.log('⚠️  Running in FIX mode - discrepancies will be corrected\n');
  }

  const discrepancies = await reconcile(fix);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (discrepancies.length === 0) {
    console.log('✅ All balances are reconciled correctly!');
  } else {
    console.log(`❌ Found ${discrepancies.length} discrepancies`);
    if (!fix) {
      console.log('   Run with --fix to correct them');
    } else {
      console.log('   All discrepancies have been fixed');
    }
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(discrepancies.length > 0 && !fix ? 1 : 0);
}

main()
  .catch((e) => {
    console.error('Error during reconciliation:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
