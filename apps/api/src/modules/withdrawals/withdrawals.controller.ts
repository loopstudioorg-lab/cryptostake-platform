import { Controller, Get, Post, Body, Param, Query, UseGuards, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { WithdrawalsService } from './withdrawals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WithdrawalStatus } from '@prisma/client';
import { IsString, IsUUID, IsOptional, MaxLength, Matches } from 'class-validator';

class CreateWithdrawalRequestDto {
  @IsUUID()
  assetId: string;

  @IsUUID()
  chainId: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'Invalid amount format' })
  amount: string;

  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address' })
  destinationAddress: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  userNotes?: string;

  @IsUUID()
  idempotencyKey: string;
}

@ApiTags('withdrawals')
@Controller({ path: 'withdrawals', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WithdrawalsController {
  constructor(private withdrawalsService: WithdrawalsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user withdrawal requests' })
  @ApiQuery({ name: 'status', required: false, enum: [
    'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PROCESSING',
    'SENT', 'CONFIRMING', 'CONFIRMED', 'COMPLETED', 'PAID_MANUALLY', 'FAILED'
  ]})
  async getWithdrawals(
    @CurrentUser('id') userId: string,
    @Query('status') status?: WithdrawalStatus,
  ) {
    return this.withdrawalsService.getUserRequests(userId, { status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get withdrawal request details' })
  async getWithdrawal(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.withdrawalsService.getRequestById(id, userId);
  }

  @Post()
  @ApiOperation({ 
    summary: 'Create withdrawal request',
    description: 'Creates a withdrawal request. Withdrawals require admin review and approval. This does NOT execute an immediate payout.'
  })
  @ApiHeader({ name: 'X-Idempotency-Key', required: true, description: 'UUID for idempotent request' })
  async createWithdrawal(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWithdrawalRequestDto,
  ) {
    return this.withdrawalsService.createRequest(userId, {
      assetId: dto.assetId,
      chainId: dto.chainId,
      amount: dto.amount,
      destinationAddress: dto.destinationAddress,
      userNotes: dto.userNotes,
      idempotencyKey: dto.idempotencyKey,
    });
  }
}
