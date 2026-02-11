import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';
import { PoolType } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // ==================== DASHBOARD ====================

  async getDashboardStats() {
    const [
      totalUsers,
      activeStakes,
      tvlResult,
      pendingWithdrawals,
      pendingWithdrawalsAmount,
      recentActivity,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'USER' } }),
      this.prisma.stakePosition.count({ where: { status: 'ACTIVE' } }),
      this.prisma.stakePosition.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { amount: true },
      }),
      this.prisma.withdrawalRequest.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.withdrawalRequest.aggregate({
        where: { status: 'PENDING_REVIEW' },
        _sum: { amount: true },
      }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          actor: {
            select: { email: true },
          },
        },
      }),
    ]);

    return {
      totalUsers,
      activeStakes,
      totalValueLocked: (tvlResult._sum.amount || new Decimal(0)).toString(),
      pendingWithdrawals,
      totalWithdrawalsPending: (pendingWithdrawalsAmount._sum.amount || new Decimal(0)).toString(),
      recentActivity,
    };
  }

  // ==================== USERS ====================

  async getUsers(options?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options?.search) {
      where.email = { contains: options.search, mode: 'insensitive' };
    }
    if (options?.role) {
      where.role = options.role;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          emailVerified: true,
          twoFactorEnabled: true,
          kycStatus: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              stakePositions: { where: { status: 'ACTIVE' } },
              withdrawalRequests: true,
              deposits: { where: { status: 'CONFIRMED' } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        balances: {
          include: { asset: true, chain: true },
        },
        stakePositions: {
          where: { status: 'ACTIVE' },
          include: {
            pool: { include: { asset: true } },
          },
        },
        withdrawalRequests: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { asset: true },
        },
        deposits: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { asset: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove sensitive data
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // ==================== POOLS ====================

  async createPool(
    adminId: string,
    params: {
      name: string;
      description?: string;
      assetId: string;
      type: PoolType;
      lockDays: number | null;
      initialApr: string;
      minStake: string;
      maxStake: string | null;
      totalCapacity: string | null;
      cooldownHours?: number;
    },
  ) {
    const pool = await this.prisma.pool.create({
      data: {
        name: params.name,
        description: params.description,
        assetId: params.assetId,
        type: params.type,
        lockDays: params.lockDays,
        currentApr: new Decimal(params.initialApr),
        minStake: new Decimal(params.minStake),
        maxStake: params.maxStake ? new Decimal(params.maxStake) : null,
        totalCapacity: params.totalCapacity ? new Decimal(params.totalCapacity) : null,
        cooldownHours: params.cooldownHours || 0,
        aprSchedules: {
          create: {
            apr: new Decimal(params.initialApr),
            effectiveFrom: new Date(),
            createdBy: adminId,
          },
        },
      },
      include: { asset: true },
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'POOL_CREATED',
      entity: 'Pool',
      entityId: pool.id,
      after: pool,
    });

    return pool;
  }

  async updatePool(
    adminId: string,
    poolId: string,
    params: Partial<{
      name: string;
      description: string;
      isActive: boolean;
      minStake: string;
      maxStake: string | null;
      totalCapacity: string | null;
      cooldownHours: number;
    }>,
  ) {
    const before = await this.prisma.pool.findUnique({ where: { id: poolId } });
    if (!before) {
      throw new NotFoundException('Pool not found');
    }

    const pool = await this.prisma.pool.update({
      where: { id: poolId },
      data: {
        ...(params.name && { name: params.name }),
        ...(params.description !== undefined && { description: params.description }),
        ...(params.isActive !== undefined && { isActive: params.isActive }),
        ...(params.minStake && { minStake: new Decimal(params.minStake) }),
        ...(params.maxStake !== undefined && { 
          maxStake: params.maxStake ? new Decimal(params.maxStake) : null 
        }),
        ...(params.totalCapacity !== undefined && { 
          totalCapacity: params.totalCapacity ? new Decimal(params.totalCapacity) : null 
        }),
        ...(params.cooldownHours !== undefined && { cooldownHours: params.cooldownHours }),
      },
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'POOL_UPDATED',
      entity: 'Pool',
      entityId: poolId,
      before,
      after: pool,
    });

    return pool;
  }

  async scheduleAprChange(
    adminId: string,
    poolId: string,
    params: {
      newApr: string;
      effectiveFrom: Date;
    },
  ) {
    const pool = await this.prisma.pool.findUnique({ where: { id: poolId } });
    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    // Cannot schedule retroactive APR changes
    if (params.effectiveFrom < new Date()) {
      throw new BadRequestException('Cannot schedule APR change in the past');
    }

    const schedule = await this.prisma.aprSchedule.create({
      data: {
        poolId,
        apr: new Decimal(params.newApr),
        effectiveFrom: params.effectiveFrom,
        createdBy: adminId,
      },
    });

    // If effective immediately, update pool
    if (params.effectiveFrom <= new Date()) {
      await this.prisma.pool.update({
        where: { id: poolId },
        data: { currentApr: new Decimal(params.newApr) },
      });
    }

    await this.auditService.log({
      actorId: adminId,
      action: 'APR_SCHEDULED',
      entity: 'AprSchedule',
      entityId: schedule.id,
      after: schedule,
    });

    return schedule;
  }

  // ==================== TREASURY ====================

  async getTreasuryWallets() {
    return this.prisma.treasuryWallet.findMany({
      include: { chain: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTreasuryWallet(
    adminId: string,
    params: {
      chainId: string;
      address: string;
      label: string;
    },
  ) {
    const wallet = await this.prisma.treasuryWallet.create({
      data: {
        chainId: params.chainId,
        address: params.address.toLowerCase(),
        label: params.label,
      },
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'TREASURY_WALLET_CREATED',
      entity: 'TreasuryWallet',
      entityId: wallet.id,
      after: wallet,
    });

    return wallet;
  }

  // ==================== CHAINS & ASSETS ====================

  async getChains() {
    return this.prisma.chain.findMany({
      include: {
        assets: true,
        _count: {
          select: { deposits: true },
        },
      },
    });
  }

  async createChain(
    adminId: string,
    params: {
      name: string;
      symbol: string;
      chainId: number;
      rpcUrl: string;
      explorerUrl: string;
      confirmationsRequired: number;
    },
  ) {
    const chain = await this.prisma.chain.create({
      data: {
        name: params.name,
        symbol: params.symbol,
        chainId: params.chainId,
        rpcUrl: params.rpcUrl,
        explorerUrl: params.explorerUrl,
        nativeAssetSymbol: params.symbol,
        confirmationsRequired: params.confirmationsRequired,
      },
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'CHAIN_CREATED',
      entity: 'Chain',
      entityId: chain.id,
      after: chain,
    });

    return chain;
  }

  async createAsset(
    adminId: string,
    params: {
      chainId: string;
      name: string;
      symbol: string;
      decimals: number;
      contractAddress: string | null;
      isNative: boolean;
      iconUrl?: string;
    },
  ) {
    const asset = await this.prisma.asset.create({
      data: {
        chainId: params.chainId,
        name: params.name,
        symbol: params.symbol,
        decimals: params.decimals,
        contractAddress: params.contractAddress?.toLowerCase() || null,
        isNative: params.isNative,
        iconUrl: params.iconUrl,
      },
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'ASSET_CREATED',
      entity: 'Asset',
      entityId: asset.id,
      after: asset,
    });

    return asset;
  }

  async getAssets() {
    return this.prisma.asset.findMany({
      include: { chain: true },
      orderBy: [{ chain: { name: 'asc' } }, { symbol: 'asc' }],
    });
  }
}
