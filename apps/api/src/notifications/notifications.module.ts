import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [AuthGuard, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
