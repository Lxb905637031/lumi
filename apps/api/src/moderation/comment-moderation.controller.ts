import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { Permissions } from '../common/permissions.decorator';
import {
  BatchUpdateCommentModerationStatusDto,
  ModerationQueueQueryDto,
  UpdateModerationStatusDto,
} from './moderation.dto';
import { CommentModerationService } from './comment-moderation.service';

@Controller('admin/moderation/comments')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class CommentModerationController {
  constructor(private readonly moderation: CommentModerationService) {}

  @Get()
  @Permissions('MODERATION_READ')
  list(@Query() query: ModerationQueueQueryDto) {
    return this.moderation.list(query);
  }

  @Patch('batch/status')
  @Permissions('MODERATION_WRITE')
  updateBatch(@CurrentUser() user: AuthenticatedUser, @Body() dto: BatchUpdateCommentModerationStatusDto) {
    return this.moderation.updateBatch(dto.ids, user.id, dto);
  }

  @Get(':id/actions')
  @Permissions('MODERATION_READ')
  actions(@Param('id') id: string, @Query() query: ModerationQueueQueryDto) {
    return this.moderation.actions(id, query);
  }

  @Patch(':id/status')
  @Permissions('MODERATION_WRITE')
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateModerationStatusDto) {
    return this.moderation.update(id, user.id, dto);
  }
}
