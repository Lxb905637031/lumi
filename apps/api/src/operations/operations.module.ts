import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditController, OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { RuntimeConfigController } from './runtime-config.controller';
import { RuntimeConfigService } from './runtime-config.service';

@Module({
  imports: [PrismaModule],
  controllers: [OperationsController, AuditController, RuntimeConfigController],
  providers: [AuthGuard, RolesGuard, OperationsService, RuntimeConfigService],
})
export class OperationsModule {}
