import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../common/auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { OperationsService } from './operations.service';

@Controller('admin/overview')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get()
  getOverview() {
    return this.operations.getOverview();
  }
}
