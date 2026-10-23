import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../common/auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { Permissions } from '../common/permissions.decorator';
import { OperationsService } from './operations.service';
import { AuditQueryDto } from './audit.dto';

@Controller('admin/overview')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get()
  @Permissions('OPERATIONS_OVERVIEW_READ')
  getOverview() {
    return this.operations.getOverview();
  }
}

@Controller('admin/audit')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly operations: OperationsService) {}

  @Get()
  @Permissions('AUDIT_READ')
  list(@Query() query: AuditQueryDto) {
    return this.operations.listAudit(query);
  }
}
