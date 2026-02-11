import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { WithdrawalsModule } from '../withdrawals/withdrawals.module';
import { PoolsModule } from '../pools/pools.module';
import { AuditModule } from '../audit/audit.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [WithdrawalsModule, PoolsModule, AuditModule, LedgerModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
