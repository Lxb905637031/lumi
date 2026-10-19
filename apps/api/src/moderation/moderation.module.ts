import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { CommentModerationController } from './comment-moderation.controller';
import { CommentModerationService } from './comment-moderation.service';

@Module({
  imports: [PrismaModule],
  controllers: [ModerationController, CommentModerationController],
  providers: [AuthGuard, RolesGuard, ModerationService, CommentModerationService],
})
export class ModerationModule {}
