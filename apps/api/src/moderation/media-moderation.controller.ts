import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { Permissions } from '../common/permissions.decorator';
import { BatchUpdateMediaReviewDto, MediaReviewQueryDto, UpdateMediaReviewDto } from './media-moderation.dto';
import { MediaModerationService } from './media-moderation.service';

@Controller('admin/moderation/media')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class MediaModerationController {
  constructor(private readonly moderation: MediaModerationService) {}

  @Get()
  @Permissions('MEDIA_REVIEW_READ')
  list(@Query() query: MediaReviewQueryDto) {
    return this.moderation.list(query);
  }

  @Patch('batch/status')
  @Permissions('MEDIA_REVIEW_WRITE')
  updateBatch(@CurrentUser() user: AuthenticatedUser, @Body() dto: BatchUpdateMediaReviewDto) {
    return this.moderation.updateBatch(user.id, dto);
  }

  @Get(':id/actions')
  @Permissions('MEDIA_REVIEW_READ')
  actions(@Param('id') id: string, @Query() query: MediaReviewQueryDto) {
    return this.moderation.actions(id, query);
  }

  @Patch(':id/status')
  @Permissions('MEDIA_REVIEW_WRITE')
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMediaReviewDto) {
    return this.moderation.update(id, user.id, dto);
  }
}
