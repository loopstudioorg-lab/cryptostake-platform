import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StakesService } from './stakes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IsString, IsUUID } from 'class-validator';

class CreateStakeDto {
  @IsUUID()
  poolId: string;

  @IsString()
  amount: string;
}

@ApiTags('stakes')
@Controller({ path: 'stakes', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StakesController {
  constructor(private stakesService: StakesService) {}

  @Get()
  @ApiOperation({ summary: 'Get user stake positions' })
  async getStakes(@CurrentUser('id') userId: string) {
    return this.stakesService.getUserStakes(userId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get staking summary' })
  async getSummary(@CurrentUser('id') userId: string) {
    return this.stakesService.getStakingSummary(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stake position details' })
  async getStake(
    @CurrentUser('id') userId: string,
    @Param('id') stakeId: string,
  ) {
    return this.stakesService.getStakeById(userId, stakeId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new stake' })
  async createStake(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateStakeDto,
  ) {
    return this.stakesService.createStake(userId, dto.poolId, dto.amount);
  }

  @Post(':id/unstake')
  @ApiOperation({ summary: 'Unstake a position' })
  async unstake(
    @CurrentUser('id') userId: string,
    @Param('id') stakeId: string,
  ) {
    return this.stakesService.unstake(userId, stakeId);
  }

  @Post(':id/claim')
  @ApiOperation({ summary: 'Claim accrued rewards' })
  async claimRewards(
    @CurrentUser('id') userId: string,
    @Param('id') stakeId: string,
  ) {
    return this.stakesService.claimRewards(userId, stakeId);
  }
}
