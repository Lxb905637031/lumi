import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { Permissions } from '../common/permissions.decorator';
import { ReportQueueQueryDto, UpdateReportStatusDto } from './moderation.dto';
import { ReportModerationService } from './report-moderation.service';

@Controller('admin/moderation/reports')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class ReportModerationController {
  constructor(private readonly reports: ReportModerationService) {}

  @Get()
  @Permissions('REPORT_READ')
  list(@Query() query: ReportQueueQueryDto) {
    return this.reports.list(query);
  }

  @Patch(':id/status')
  @Permissions('REPORT_RESOLVE')
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateReportStatusDto) {
    return this.reports.update(id, user.id, dto);
  }
}
