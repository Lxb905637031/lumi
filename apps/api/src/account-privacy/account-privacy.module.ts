import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountPrivacyController, AccountPrivacyOperationsController } from './account-privacy.controller';
import { AccountPrivacyService } from './account-privacy.service';

@Module({
  imports: [PrismaModule],
  controllers: [AccountPrivacyController, AccountPrivacyOperationsController],
  providers: [AuthGuard, RolesGuard, AccountPrivacyService],
  exports: [AccountPrivacyService],
})
export class AccountPrivacyModule {}
