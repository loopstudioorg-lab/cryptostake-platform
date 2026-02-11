import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { StakesModule } from '../stakes/stakes.module';

@Module({
  imports: [LedgerModule, StakesModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
