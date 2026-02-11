import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';
import { FraudService } from './fraud.service';
import { LedgerModule } from '../ledger/ledger.module';
import { AuditModule } from '../audit/audit.module';
import { QUEUE_NAMES } from '@crypto-stake/shared';

@Module({
  imports: [
    LedgerModule,
    AuditModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.PAYOUT_PROCESSOR,
    }),
  ],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService, FraudService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
