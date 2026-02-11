import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { BalanceService } from './balance.service';

@Module({
  providers: [LedgerService, BalanceService],
  exports: [LedgerService, BalanceService],
})
export class LedgerModule {}
