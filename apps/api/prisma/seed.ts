import { PrismaClient, RoleType, LedgerEntryType, LedgerEntryDirection, DepositStatus, PoolStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ============================================
  // STEP 1: Create Chains
  // ============================================
  console.log('📡 Creating chains...');
  
  const chains = await Promise.all([
    prisma.chain.upsert({
      where: { slug: 'ethereum' },
      update: {},
      create: {
        id: crypto.randomUUID(),
        name: 'Ethereum',
        slug: 'ethereum',
        chainId: 1,
        rpcUrl: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
        explorerUrl: 'https://etherscan.io',
        nativeCurrency: 'ETH',
        confirmations: 12,
        isActive: true,
      },
    }),
    prisma.chain.upsert({
      where: { slug: 'bsc' },
      update: {},
      create: {
        id: crypto.randomUUID(),
        name: 'BNB Smart Chain',
        slug: 'bsc',
        chainId: 56,
        rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
        explorerUrl: 'https://bscscan.com',
        nativeCurrency: 'BNB',
        confirmations: 15,
        isActive: true,
      },
    }),
    prisma.chain.upsert({
      where: { slug: 'polygon' },
      update: {},
      create: {
        id: crypto.randomUUID(),
        name: 'Polygon',
        slug: 'polygon',
        chainId: 137,
        rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
        explorerUrl: 'https://polygonscan.com',
        nativeCurrency: 'MATIC',
        confirmations: 128,
        isActive: true,
      },
    }),
  ]);

  console.log(`   ✓ Created ${chains.length} chains`);

  // ============================================
  // STEP 2: Create Assets
  // ============================================
  console.log('💰 Creating assets...');

  const assets = await Promise.all([
    // Ethereum assets
    prisma.asset.upsert({
      where: { 
        chainId_contractAddress: { 
          chainId: chains[0].id, 
          contractAddress: 'native' 
        } 
      },
      update: {},
      create: {
        id: crypto.randomUUID(),
        chainId: chains[0].id,
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        contractAddress: 'native',
        isNative: true,
        isActive: true,
        logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
      },
    }),
    prisma.asset.upsert({
      where: { 
        chainId_contractAddress: { 
          chainId: chains[0].id, 
          contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7' 
        } 
      },
      update: {},
      create: {
        id: crypto.randomUUID(),
        chainId: chains[0].id,
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        isNative: false,
        isActive: true,
        logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.svg',
      },
    }),
    prisma.asset.upsert({
      where: { 
        chainId_contractAddress: { 
          chainId: chains[0].id, 
          contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' 
        } 
      },
      update: {},
      create: {
        id: crypto.randomUUID(),
        chainId: chains[0].id,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        isNative: false,
        isActive: true,
        logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg',
      },
    }),
    // BSC assets
    prisma.asset.upsert({
      where: { 
        chainId_contractAddress: { 
          chainId: chains[1].id, 
          contractAddress: 'native' 
        } 
      },
      update: {},
      create: {
        id: crypto.randomUUID(),
        chainId: chains[1].id,
        symbol: 'BNB',
        name: 'BNB',
        decimals: 18,
        contractAddress: 'native',
        isNative: true,
        isActive: true,
        logoUrl: 'https://cryptologos.cc/logos/bnb-bnb-logo.svg',
      },
    }),
    prisma.asset.upsert({
      where: { 
        chainId_contractAddress: { 
          chainId: chains[1].id, 
          contractAddress: '0x55d398326f99059ff775485246999027b3197955' 
        } 
      },
      update: {},
      create: {
        id: crypto.randomUUID(),
        chainId: chains[1].id,
        symbol: 'USDT',
        name: 'Tether USD (BSC)',
        decimals: 18,
        contractAddress: '0x55d398326f99059ff775485246999027b3197955',
        isNative: false,
        isActive: true,
        logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.svg',
      },
    }),
    // Polygon assets
    prisma.asset.upsert({
      where: { 
        chainId_contractAddress: { 
          chainId: chains[2].id, 
          contractAddress: 'native' 
        } 
      },
      update: {},
      create: {
        id: crypto.randomUUID(),
        chainId: chains[2].id,
        symbol: 'MATIC',
        name: 'Polygon',
        decimals: 18,
        contractAddress: 'native',
        isNative: true,
        isActive: true,
        logoUrl: 'https://cryptologos.cc/logos/polygon-matic-logo.svg',
      },
    }),
    prisma.asset.upsert({
      where: { 
        chainId_contractAddress: { 
          chainId: chains[2].id, 
          contractAddress: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174' 
        } 
      },
      update: {},
      create: {
        id: crypto.randomUUID(),
        chainId: chains[2].id,
        symbol: 'USDC',
        name: 'USD Coin (Polygon)',
        decimals: 6,
        contractAddress: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        isNative: false,
        isActive: true,
        logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg',
      },
    }),
  ]);

  console.log(`   ✓ Created ${assets.length} assets`);

  // ============================================
  // STEP 3: Create Super Admin User
  // ============================================
  console.log('👤 Creating super admin user...');

  const adminPassword = process.env.ADMIN_PASSWORD || 'SuperAdmin123!';
  const hashedPassword = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@cryptostake.io' },
    update: {},
    create: {
      id: crypto.randomUUID(),
      email: 'admin@cryptostake.io',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
      isEmailVerified: true,
      roles: {
        create: {
          id: crypto.randomUUID(),
          role: RoleType.SUPER_ADMIN,
        },
      },
    },
    include: { roles: true },
  });

  console.log(`   ✓ Created super admin: ${superAdmin.email}`);
  console.log(`   ⚠️  Password: ${adminPassword}`);
  console.log(`   ⚠️  2FA is disabled - enable it after first login!`);

  // Create a demo user
  const demoUserPassword = process.env.DEMO_USER_PASSWORD || 'DemoUser123!';
  const hashedDemoPassword = await argon2.hash(demoUserPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@cryptostake.io' },
    update: {},
    create: {
      id: crypto.randomUUID(),
      email: 'demo@cryptostake.io',
      password: hashedDemoPassword,
      firstName: 'Demo',
      lastName: 'User',
      isActive: true,
      isEmailVerified: true,
      roles: {
        create: {
          id: crypto.randomUUID(),
          role: RoleType.USER,
        },
      },
    },
    include: { roles: true },
  });

  console.log(`   ✓ Created demo user: ${demoUser.email}`);
  console.log(`   ⚠️  Password: ${demoUserPassword}`);

  // ============================================
  // STEP 4: Create Demo Staking Pools
  // ============================================
  console.log('🏊 Creating staking pools...');

  const ethAsset = assets.find(a => a.symbol === 'ETH' && a.chainId === chains[0].id)!;
  const usdtEthAsset = assets.find(a => a.symbol === 'USDT' && a.chainId === chains[0].id)!;
  const bnbAsset = assets.find(a => a.symbol === 'BNB')!;
  const maticAsset = assets.find(a => a.symbol === 'MATIC')!;

  const pools = await Promise.all([
    // ETH Flexible Pool
    prisma.pool.upsert({
      where: { slug: 'eth-flexible' },
      update: {},
      create: {
        id: crypto.randomUUID(),
        name: 'ETH Flexible Staking',
        slug: 'eth-flexible',
        description: 'Stake ETH with no lock period. Withdraw anytime.',
        assetId: ethAsset.id,
        chainId: chains[0].id,
        apr: 4.5,
        minStake: '0.01',
        maxStake: '100',
        totalCap: '10000',
        currentStaked: '0',
        lockDays: 0,
        status: PoolStatus.ACTIVE,
        cooldownHours: 0,
        schedules: {
          create: {
            id: crypto.randomUUID(),
            apr: 4.5,
            effectiveFrom: new Date(),
          },
        },
      },
    }),
    // ETH 30-Day Lock Pool
    prisma.pool.upsert({
      where: { slug: 'eth-30day' },
      update: {},
      create: {
        id: crypto.randomUUID(),
        name: 'ETH 30-Day Lock',
        slug: 'eth-30day',
        description: 'Higher returns with a 30-day lock period.',
        assetId: ethAsset.id,
        chainId: chains[0].id,
        apr: 8.0,
        minStake: '0.1',
        maxStake: '50',
        totalCap: '5000',
        currentStaked: '0',
        lockDays: 30,
        status: PoolStatus.ACTIVE,
        cooldownHours: 0,
        schedules: {
          create: {
            id: crypto.randomUUID(),
            apr: 8.0,
            effectiveFrom: new Date(),
          },
        },
      },
    }),
    // ETH 90-Day Lock Pool
    prisma.pool.upsert({
      where: { slug: 'eth-90day' },
      update: {},
      create: {
        id: crypto.randomUUID(),
        name: 'ETH 90-Day Lock',
        slug: 'eth-90day',
        description: 'Maximum returns with a 90-day lock period.',
        assetId: ethAsset.id,
        chainId: chains[0].id,
        apr: 12.0,
        minStake: '0.5',
        maxStake: '25',
        totalCap: '2500',
        currentStaked: '0',
        lockDays: 90,
        status: PoolStatus.ACTIVE,
        cooldownHours: 0,
        schedules: {
          create: {
            id: crypto.randomUUID(),
            apr: 12.0,
            effectiveFrom: new Date(),
          },
        },
      },
    }),
    // USDT Flexible Pool
    prisma.pool.upsert({
      where: { slug: 'usdt-flexible' },
      update: {},
      create: {
        id: crypto.randomUUID(),
        name: 'USDT Flexible Staking',
        slug: 'usdt-flexible',
        description: 'Earn rewards on your USDT with flexible withdrawals.',
        assetId: usdtEthAsset.id,
        chainId: chains[0].id,
        apr: 6.0,
        minStake: '100',
        maxStake: '1000000',
        totalCap: '50000000',
        currentStaked: '0',
        lockDays: 0,
        status: PoolStatus.ACTIVE,
        cooldownHours: 0,
        schedules: {
          create: {
            id: crypto.randomUUID(),
            apr: 6.0,
            effectiveFrom: new Date(),
          },
        },
      },
    }),
    // BNB 7-Day Lock Pool
    prisma.pool.upsert({
      where: { slug: 'bnb-7day' },
      update: {},
      create: {
        id: crypto.randomUUID(),
        name: 'BNB 7-Day Lock',
        slug: 'bnb-7day',
        description: 'Short-term BNB staking with weekly unlocks.',
        assetId: bnbAsset.id,
        chainId: chains[1].id,
        apr: 5.5,
        minStake: '0.1',
        maxStake: '500',
        totalCap: '50000',
        currentStaked: '0',
        lockDays: 7,
        status: PoolStatus.ACTIVE,
        cooldownHours: 0,
        schedules: {
          create: {
            id: crypto.randomUUID(),
            apr: 5.5,
            effectiveFrom: new Date(),
          },
        },
      },
    }),
    // MATIC Flexible Pool
    prisma.pool.upsert({
      where: { slug: 'matic-flexible' },
      update: {},
      create: {
        id: crypto.randomUUID(),
        name: 'MATIC Flexible Staking',
        slug: 'matic-flexible',
        description: 'Stake MATIC on Polygon with no lock period.',
        assetId: maticAsset.id,
        chainId: chains[2].id,
        apr: 7.0,
        minStake: '10',
        maxStake: '100000',
        totalCap: '10000000',
        currentStaked: '0',
        lockDays: 0,
        status: PoolStatus.ACTIVE,
        cooldownHours: 0,
        schedules: {
          create: {
            id: crypto.randomUUID(),
            apr: 7.0,
            effectiveFrom: new Date(),
          },
        },
      },
    }),
  ]);

  console.log(`   ✓ Created ${pools.length} staking pools`);

  // ============================================
  // STEP 5: Create Demo Data for Demo User
  // ============================================
  console.log('📊 Creating demo data for demo user...');

  // Create deposit address for demo user
  const depositAddress = await prisma.depositAddress.upsert({
    where: {
      userId_chainId: {
        userId: demoUser.id,
        chainId: chains[0].id,
      },
    },
    update: {},
    create: {
      id: crypto.randomUUID(),
      userId: demoUser.id,
      chainId: chains[0].id,
      address: '0xDemoDepositAddress' + crypto.randomBytes(16).toString('hex').slice(0, 24),
      derivationPath: "m/44'/60'/0'/0/1",
    },
  });

  console.log(`   ✓ Created deposit address: ${depositAddress.address.slice(0, 20)}...`);

  // Create a demo deposit
  const demoDeposit = await prisma.deposit.create({
    data: {
      id: crypto.randomUUID(),
      userId: demoUser.id,
      assetId: ethAsset.id,
      chainId: chains[0].id,
      depositAddressId: depositAddress.id,
      txHash: '0x' + crypto.randomBytes(32).toString('hex'),
      fromAddress: '0x' + crypto.randomBytes(20).toString('hex'),
      amount: '1.5',
      confirmations: 12,
      requiredConfirmations: 12,
      status: DepositStatus.CONFIRMED,
      confirmedAt: new Date(),
    },
  });

  // Create ledger entry for deposit
  await prisma.ledgerEntry.create({
    data: {
      id: crypto.randomUUID(),
      userId: demoUser.id,
      assetId: ethAsset.id,
      chainId: chains[0].id,
      entryType: LedgerEntryType.DEPOSIT_CONFIRMED,
      direction: LedgerEntryDirection.CREDIT,
      amount: '1.5',
      referenceType: 'Deposit',
      referenceId: demoDeposit.id,
      metadata: {
        txHash: demoDeposit.txHash,
        confirmations: 12,
      },
    },
  });

  // Create balance cache
  await prisma.balanceCache.upsert({
    where: {
      userId_assetId_chainId: {
        userId: demoUser.id,
        assetId: ethAsset.id,
        chainId: chains[0].id,
      },
    },
    update: {
      available: '0.5',
      staked: '1.0',
      rewardsAccrued: '0.0123',
      withdrawalsPending: '0',
    },
    create: {
      id: crypto.randomUUID(),
      userId: demoUser.id,
      assetId: ethAsset.id,
      chainId: chains[0].id,
      available: '0.5',
      staked: '1.0',
      rewardsAccrued: '0.0123',
      withdrawalsPending: '0',
    },
  });

  // Create a stake position
  const stakePosition = await prisma.stakePosition.create({
    data: {
      id: crypto.randomUUID(),
      userId: demoUser.id,
      poolId: pools[0].id, // ETH Flexible
      amount: '1.0',
      rewardsAccrued: '0.0123',
      stakedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      isActive: true,
    },
  });

  // Create ledger entry for stake
  await prisma.ledgerEntry.create({
    data: {
      id: crypto.randomUUID(),
      userId: demoUser.id,
      assetId: ethAsset.id,
      chainId: chains[0].id,
      entryType: LedgerEntryType.STAKE_CREATED,
      direction: LedgerEntryDirection.DEBIT,
      amount: '1.0',
      referenceType: 'StakePosition',
      referenceId: stakePosition.id,
    },
  });

  console.log(`   ✓ Created demo deposit, stake position, and balances`);

  // ============================================
  // COMPLETE
  // ============================================
  console.log('\n✅ Database seeding completed!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  SUPER ADMIN CREDENTIALS:');
  console.log('  Email:    admin@cryptostake.io');
  console.log(`  Password: ${adminPassword}`);
  console.log('  ⚠️  Please enable 2FA after first login!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  DEMO USER CREDENTIALS:');
  console.log('  Email:    demo@cryptostake.io');
  console.log(`  Password: ${demoUserPassword}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
