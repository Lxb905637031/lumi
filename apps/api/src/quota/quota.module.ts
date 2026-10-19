import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { QuotaController } from './quota.controller';
import { QuotaService } from './quota.service';

@Module({
  imports: [PrismaModule],
  controllers: [QuotaController],
  providers: [AuthGuard, QuotaService],
  exports: [QuotaService],
})
export class QuotaModule {}
