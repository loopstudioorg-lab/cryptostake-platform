import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { IsString, IsUUID, IsOptional, IsNumber, IsEnum, IsBoolean, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// DTOs
class CreatePoolDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsUUID() assetId: string;
  @IsEnum(['FLEXIBLE', 'FIXED']) type: 'FLEXIBLE' | 'FIXED';
  @IsOptional() @IsNumber() @Min(0) @Max(365) lockDays?: number;
  @IsString() initialApr: string;
  @IsString() minStake: string;
  @IsOptional() @IsString() maxStake?: string;
  @IsOptional() @IsString() totalCapacity?: string;
  @IsOptional() @IsNumber() cooldownHours?: number;
}

class UpdatePoolDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() minStake?: string;
  @IsOptional() @IsString() maxStake?: string;
  @IsOptional() @IsString() totalCapacity?: string;
  @IsOptional() @IsNumber() cooldownHours?: number;
}

class ScheduleAprDto {
  @IsString() newApr: string;
  @IsDateString() effectiveFrom: string;
}

class ReviewWithdrawalDto {
  @IsOptional() @IsString() adminNotes?: string;
}

class MarkPaidManuallyDto {
  @IsOptional() @IsString() proofUrl?: string;
  @IsString() adminNotes: string;
}

class CreateTreasuryWalletDto {
  @IsUUID() chainId: string;
  @IsString() address: string;
  @IsString() label: string;
}

class CreateChainDto {
  @IsString() name: string;
  @IsString() symbol: string;
  @IsNumber() chainId: number;
  @IsString() rpcUrl: string;
  @IsString() explorerUrl: string;
  @IsNumber() @Min(1) @Max(200) confirmationsRequired: number;
}

class CreateAssetDto {
  @IsUUID() chainId: string;
  @IsString() name: string;
  @IsString() symbol: string;
  @IsNumber() @Min(0) @Max(18) decimals: number;
  @IsOptional() @IsString() contractAddress?: string;
  @IsBoolean() isNative: boolean;
  @IsOptional() @IsString() iconUrl?: string;
}

@ApiTags('admin')
@Controller({ path: 'admin', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@ApiBearerAuth()
export class AdminController {
  constructor(
    private adminService: AdminService,
    private withdrawalsService: WithdrawalsService,
    private auditService: AuditService,
  ) {}

  // ==================== DASHBOARD ====================

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  // ==================== USERS ====================

  @Get('users')
  @ApiOperation({ summary: 'List users' })
  async getUsers(
    @Query('page') @Type(() => Number) page?: number,
    @Query('limit') @Type(() => Number) limit?: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.adminService.getUsers({ page, limit, search, role });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user details' })
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  // ==================== POOLS ====================

  @Get('pools')
  @ApiOperation({ summary: 'List all pools (including inactive)' })
  async getPools() {
    const { PrismaService } = await import('../../prisma/prisma.service');
    // Use injected prisma directly via service
    return this.adminService['prisma'].pool.findMany({
      include: {
        asset: { include: { chain: true } },
        aprSchedules: { orderBy: { effectiveFrom: 'desc' }, take: 5 },
        _count: { select: { stakePositions: { where: { status: 'ACTIVE' } } } },
      },
    });
  }

  @Post('pools')
  @ApiOperation({ summary: 'Create a new pool' })
  async createPool(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreatePoolDto,
  ) {
    return this.adminService.createPool(user.id, {
      ...dto,
      lockDays: dto.lockDays ?? null,
      maxStake: dto.maxStake ?? null,
      totalCapacity: dto.totalCapacity ?? null,
    });
  }

  @Put('pools/:id')
  @ApiOperation({ summary: 'Update a pool' })
  async updatePool(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdatePoolDto,
  ) {
    return this.adminService.updatePool(user.id, id, dto);
  }

  @Post('pools/:id/apr')
  @ApiOperation({ summary: 'Schedule APR change' })
  async scheduleApr(
    @CurrentUser() user: CurrentUserData,
    @Param('id') poolId: string,
    @Body() dto: ScheduleAprDto,
  ) {
    return this.adminService.scheduleAprChange(user.id, poolId, {
      newApr: dto.newApr,
      effectiveFrom: new Date(dto.effectiveFrom),
    });
  }

  // ==================== WITHDRAWALS ====================

  @Get('withdrawals')
  @ApiOperation({ summary: 'Get withdrawal queue' })
  async getWithdrawalQueue(
    @Query('status') status?: string,
    @Query('page') @Type(() => Number) page?: number,
    @Query('limit') @Type(() => Number) limit?: number,
  ) {
    return this.withdrawalsService.getWithdrawalQueue({
      status: status as any,
      page,
      limit,
    });
  }

  @Get('withdrawals/:id')
  @ApiOperation({ summary: 'Get withdrawal details' })
  async getWithdrawalDetail(@Param('id') id: string) {
    return this.withdrawalsService.getRequestById(id);
  }

  @Post('withdrawals/:id/approve')
  @ApiOperation({ summary: 'Approve withdrawal request' })
  async approveWithdrawal(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: ReviewWithdrawalDto,
  ) {
    const result = await this.withdrawalsService.approveRequest(id, user.id, dto.adminNotes);
    
    await this.auditService.log({
      actorId: user.id,
      action: 'WITHDRAWAL_APPROVED',
      entity: 'WithdrawalRequest',
      entityId: id,
      after: { adminNotes: dto.adminNotes },
    });

    return result;
  }

  @Post('withdrawals/:id/reject')
  @ApiOperation({ summary: 'Reject withdrawal request' })
  async rejectWithdrawal(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: ReviewWithdrawalDto,
  ) {
    if (!dto.adminNotes) {
      throw new Error('Admin notes required for rejection');
    }

    const result = await this.withdrawalsService.rejectRequest(id, user.id, dto.adminNotes);
    
    await this.auditService.log({
      actorId: user.id,
      action: 'WITHDRAWAL_REJECTED',
      entity: 'WithdrawalRequest',
      entityId: id,
      after: { adminNotes: dto.adminNotes },
    });

    return result;
  }

  @Post('withdrawals/:id/mark-paid')
  @ApiOperation({ summary: 'Mark withdrawal as paid manually' })
  async markPaidManually(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: MarkPaidManuallyDto,
  ) {
    const result = await this.withdrawalsService.markPaidManually(id, user.id, dto);
    
    await this.auditService.log({
      actorId: user.id,
      action: 'WITHDRAWAL_PAID_MANUALLY',
      entity: 'WithdrawalRequest',
      entityId: id,
      after: dto,
    });

    return result;
  }

  // ==================== TREASURY ====================

  @Get('treasury')
  @ApiOperation({ summary: 'Get treasury wallets' })
  async getTreasuryWallets() {
    return this.adminService.getTreasuryWallets();
  }

  @Post('treasury')
  @Roles('SUPER_ADMIN') // Only super admin can create treasury wallets
  @ApiOperation({ summary: 'Create treasury wallet' })
  async createTreasuryWallet(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateTreasuryWalletDto,
  ) {
    return this.adminService.createTreasuryWallet(user.id, dto);
  }

  // ==================== CHAINS & ASSETS ====================

  @Get('chains')
  @ApiOperation({ summary: 'Get all chains' })
  async getChains() {
    return this.adminService.getChains();
  }

  @Post('chains')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new chain' })
  async createChain(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateChainDto,
  ) {
    return this.adminService.createChain(user.id, dto);
  }

  @Get('assets')
  @ApiOperation({ summary: 'Get all assets' })
  async getAssets() {
    return this.adminService.getAssets();
  }

  @Post('assets')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new asset' })
  async createAsset(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateAssetDto,
  ) {
    return this.adminService.createAsset(user.id, {
      ...dto,
      contractAddress: dto.contractAddress || null,
    });
  }

  // ==================== AUDIT LOGS ====================

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get audit logs' })
  async getAuditLogs(
    @Query('page') @Type(() => Number) page?: number,
    @Query('limit') @Type(() => Number) limit?: number,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getLogs({
      page,
      limit,
      actorId,
      action,
      entity,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }
}
