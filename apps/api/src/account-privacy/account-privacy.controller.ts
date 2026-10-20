import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CursorPaginationDto } from '../common/pagination/pagination.dto';
import { CreateDataExportDto } from './account-privacy.dto';
import { AccountPrivacyService } from './account-privacy.service';

@Controller('account/privacy')
@UseGuards(AuthGuard)
export class AccountPrivacyController {
  constructor(private readonly privacy: AccountPrivacyService) {}

  @Post('exports')
  createExport(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDataExportDto) {
    return this.privacy.createExport(user.id, dto.confirmation);
  }

  @Get('exports')
  listExports(@CurrentUser() user: AuthenticatedUser, @Query() query: CursorPaginationDto) {
    return this.privacy.listExports(user.id, query);
  }

  @Get('exports/:id')
  getExport(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.privacy.getExport(user.id, id);
  }

  @Get('exports/:id/download')
  downloadExport(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.privacy.downloadExport(user.id, id);
  }

  @Post('deletion')
  requestDeletion(@CurrentUser() user: AuthenticatedUser) {
    return this.privacy.requestDeletion(user.id);
  }

  @Get('deletion')
  getDeletion(@CurrentUser() user: AuthenticatedUser) {
    return this.privacy.getDeletion(user.id);
  }

  @Delete('deletion')
  cancelDeletion(@CurrentUser() user: AuthenticatedUser) {
    return this.privacy.cancelDeletion(user.id);
  }
}

@Controller('admin/privacy')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AccountPrivacyOperationsController {
  constructor(private readonly privacy: AccountPrivacyService) {}

  @Post('process')
  process() {
    return Promise.all([this.privacy.processPendingExports(20), this.privacy.processDueDeletions(20)]).then(
      ([exportsResult, deletionsResult]) => ({ exports: exportsResult, deletions: deletionsResult }),
    );
  }
}
