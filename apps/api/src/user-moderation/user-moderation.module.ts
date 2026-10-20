import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModerationController } from './user-moderation.controller';
import { UserModerationService } from './user-moderation.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserModerationController],
  providers: [AuthGuard, RolesGuard, UserModerationService],
})
export class UserModerationModule {}
