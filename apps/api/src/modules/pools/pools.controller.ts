import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PoolsService } from './pools.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('pools')
@Controller({ path: 'pools', version: '1' })
@UseGuards(JwtAuthGuard)
export class PoolsController {
  constructor(private poolsService: PoolsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all active staking pools' })
  @ApiQuery({ name: 'assetId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['FLEXIBLE', 'FIXED'] })
  async getPools(
    @Query('assetId') assetId?: string,
    @Query('type') type?: 'FLEXIBLE' | 'FIXED',
  ) {
    return this.poolsService.findAll({ isActive: true, assetId, type });
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get pool details' })
  async getPool(@Param('id') id: string) {
    return this.poolsService.getPoolStats(id);
  }

  @Get(':id/calculator')
  @Public()
  @ApiOperation({ summary: 'Calculate estimated rewards' })
  @ApiQuery({ name: 'amount', required: true })
  @ApiQuery({ name: 'days', required: true })
  async calculateRewards(
    @Param('id') poolId: string,
    @Query('amount') amount: string,
    @Query('days') days: string,
  ) {
    return this.poolsService.calculateEstimatedRewards(
      poolId,
      amount,
      parseInt(days, 10),
    );
  }
}
