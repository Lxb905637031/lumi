import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [PrismaModule],
  controllers: [OperationsController],
  providers: [AuthGuard, RolesGuard, OperationsService],
})
export class OperationsModule {}
