import { Controller, Get, Post, Param, Query, UseGuards, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DepositsService } from './deposits.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IsUUID } from 'class-validator';

class GetDepositAddressDto {
  @IsUUID()
  chainId: string;
}

@ApiTags('deposits')
@Controller({ path: 'deposits', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DepositsController {
  constructor(private depositsService: DepositsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user deposits' })
  @ApiQuery({ name: 'chainId', required: false })
  @ApiQuery({ name: 'status', required: false })
  async getDeposits(
    @CurrentUser('id') userId: string,
    @Query('chainId') chainId?: string,
    @Query('status') status?: string,
  ) {
    return this.depositsService.getUserDeposits(userId, { chainId, status });
  }

  @Get('addresses')
  @ApiOperation({ summary: 'Get all deposit addresses' })
  async getDepositAddresses(@CurrentUser('id') userId: string) {
    return this.depositsService.getDepositAddresses(userId);
  }

  @Post('address')
  @ApiOperation({ summary: 'Get or create deposit address for a chain' })
  async getDepositAddress(
    @CurrentUser('id') userId: string,
    @Body() dto: GetDepositAddressDto,
  ) {
    const address = await this.depositsService.getOrCreateDepositAddress(
      userId,
      dto.chainId,
    );

    return {
      address: address.address,
      chainId: address.chainId,
      instructions: 'Send only supported tokens to this address. Deposits typically require 12-128 confirmations depending on the network.',
      warning: 'Sending unsupported tokens may result in permanent loss of funds.',
    };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get deposit summary' })
  async getDepositSummary(@CurrentUser('id') userId: string) {
    return this.depositsService.getDepositSummary(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get deposit details' })
  async getDeposit(@Param('id') id: string) {
    return this.depositsService.getDepositById(id);
  }
}
