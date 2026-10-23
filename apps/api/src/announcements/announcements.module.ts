import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { ANNOUNCEMENT_QUEUE, ANNOUNCEMENT_QUEUE_NAME } from './announcement-queue.port';
import { BullMqAnnouncementQueueAdapter } from './bullmq-announcement-queue.adapter';
import { AnnouncementProcessor } from './announcement.processor';
import { AnnouncementRecoveryService } from './announcement-recovery.service';

@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: ANNOUNCEMENT_QUEUE_NAME })],
  controllers: [AnnouncementsController],
  providers: [
    AuthGuard,
    RolesGuard,
    AnnouncementsService,
    BullMqAnnouncementQueueAdapter,
    AnnouncementProcessor,
    AnnouncementRecoveryService,
    { provide: ANNOUNCEMENT_QUEUE, useExisting: BullMqAnnouncementQueueAdapter },
  ],
})
export class AnnouncementsModule {}
