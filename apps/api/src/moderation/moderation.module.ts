import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { CommentModerationController } from './comment-moderation.controller';
import { CommentModerationService } from './comment-moderation.service';
import { ReportModerationController } from './report-moderation.controller';
import { ReportModerationService } from './report-moderation.service';
import { MediaModule } from '../media/media.module';
import { MediaModerationController } from './media-moderation.controller';
import { MediaModerationService } from './media-moderation.service';

@Module({
  imports: [PrismaModule, MediaModule],
  controllers: [
    ModerationController,
    CommentModerationController,
    ReportModerationController,
    MediaModerationController,
  ],
  providers: [
    AuthGuard,
    RolesGuard,
    ModerationService,
    CommentModerationService,
    ReportModerationService,
    MediaModerationService,
  ],
})
export class ModerationModule {}
