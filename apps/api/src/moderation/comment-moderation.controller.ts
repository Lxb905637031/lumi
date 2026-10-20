import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { ModerationQueueQueryDto, UpdateModerationStatusDto } from './moderation.dto';
import { CommentModerationService } from './comment-moderation.service';

@Controller('admin/moderation/comments')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class CommentModerationController {
  constructor(private readonly moderation: CommentModerationService) {}

  @Get()
  list(@Query() query: ModerationQueueQueryDto) {
    return this.moderation.list(query);
  }

  @Get(':id/actions')
  actions(@Param('id') id: string, @Query() query: ModerationQueueQueryDto) {
    return this.moderation.actions(id, query);
  }

  @Patch(':id/status')
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateModerationStatusDto) {
    return this.moderation.update(id, user.id, dto);
  }
}
