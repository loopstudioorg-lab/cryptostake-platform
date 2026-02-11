import { Module } from '@nestjs/common';
import { StakesService } from './stakes.service';
import { StakesController } from './stakes.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { PoolsModule } from '../pools/pools.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [LedgerModule, PoolsModule, AuditModule],
  controllers: [StakesController],
  providers: [StakesService],
  exports: [StakesService],
})
export class StakesModule {}
