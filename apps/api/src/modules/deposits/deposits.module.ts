import { Module } from '@nestjs/common';
import { DepositsService } from './deposits.service';
import { DepositsController } from './deposits.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [LedgerModule, BlockchainModule],
  controllers: [DepositsController],
  providers: [DepositsService],
  exports: [DepositsService],
})
export class DepositsModule {}
