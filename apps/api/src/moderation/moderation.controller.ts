import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { BatchUpdateModerationStatusDto, ModerationQueueQueryDto, UpdateModerationStatusDto } from './moderation.dto';
import { ModerationService } from './moderation.service';

@Controller('admin/moderation/posts')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get()
  list(@Query() query: ModerationQueueQueryDto) {
    return this.moderation.listPosts(query);
  }

  @Patch('batch/status')
  updateBatchStatus(@CurrentUser() user: AuthenticatedUser, @Body() dto: BatchUpdateModerationStatusDto) {
    return this.moderation.updatePostStatuses(dto.ids, user.id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateModerationStatusDto,
  ) {
    return this.moderation.updatePostStatus(id, user.id, dto);
  }
}
