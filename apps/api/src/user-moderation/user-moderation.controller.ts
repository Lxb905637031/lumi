import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { MuteUserDto, UserModerationQueryDto, UpdateUserModerationDto } from './user-moderation.dto';
import { UserModerationService } from './user-moderation.service';

@Controller('admin/users')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UserModerationController {
  constructor(private readonly moderation: UserModerationService) {}

  @Get()
  list(@Query() query: UserModerationQueryDto) {
    return this.moderation.list(query);
  }

  @Get(':id/actions')
  actions(@Param('id') id: string, @Query() query: UserModerationQueryDto) {
    return this.moderation.actions(id, query);
  }

  @Get(':id/mutes')
  mutes(@Param('id') id: string, @Query() query: UserModerationQueryDto) {
    return this.moderation.mutes(id, query);
  }

  @Patch(':id/status')
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserModerationDto) {
    return this.moderation.update(id, user.id, dto);
  }

  @Post(':id/mute')
  mute(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: MuteUserDto) {
    return this.moderation.mute(id, user.id, dto);
  }

  @Post(':id/unmute')
  unmute(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: MuteUserDto) {
    return this.moderation.unmute(id, user.id, dto);
  }
}
