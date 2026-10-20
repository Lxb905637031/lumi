import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { RollbackRuntimeConfigDto, UpsertRuntimeConfigDto } from './runtime-config.dto';
import { RuntimeConfigService } from './runtime-config.service';

@Controller('admin/runtime-configs')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class RuntimeConfigController {
  constructor(private readonly configs: RuntimeConfigService) {}

  @Get()
  list() {
    return this.configs.list();
  }

  @Get(':key/history')
  history(@Param('key') key: string) {
    return this.configs.history(key);
  }

  @Patch()
  upsert(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertRuntimeConfigDto) {
    return this.configs.upsert(user.id, dto.key, dto.value, dto.reason);
  }

  @Post('rollback')
  rollback(@CurrentUser() user: AuthenticatedUser, @Body() dto: RollbackRuntimeConfigDto) {
    return this.configs.rollback(user.id, dto);
  }
}
