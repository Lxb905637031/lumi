import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminChallengesController, ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';

@Module({
  imports: [PrismaModule],
  controllers: [ChallengesController, AdminChallengesController],
  providers: [AuthGuard, RolesGuard, ChallengesService],
  exports: [ChallengesService],
})
export class ChallengesModule {}
