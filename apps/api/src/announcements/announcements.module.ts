import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

@Module({
  imports: [PrismaModule],
  controllers: [AnnouncementsController],
  providers: [AuthGuard, RolesGuard, AnnouncementsService],
})
export class AnnouncementsModule {}
