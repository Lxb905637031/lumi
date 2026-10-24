import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import {
  AnnouncementQueryDto,
  CreateAnnouncementDto,
  PublishAnnouncementDto,
  UpdateAnnouncementDto,
} from './announcements.dto';
import { AnnouncementsService } from './announcements.service';
import { ensureRequestId } from '../common/api-response';

@Controller('admin/announcements')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  list(@Query() query: AnnouncementQueryDto) {
    return this.announcements.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.announcements.get(id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAnnouncementDto) {
    return this.announcements.create(user.id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.announcements.update(id, dto);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string, @Body() dto: PublishAnnouncementDto, @Req() request: FastifyRequest) {
    return this.announcements.publish(id, dto, ensureRequestId(request));
  }
}
