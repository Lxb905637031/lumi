import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  ANNOUNCEMENT_DELIVERY_BATCH_SIZE,
  ANNOUNCEMENT_QUEUE_NAME,
  type EnqueueAnnouncementCommand,
} from './announcement-queue.port';

@Injectable()
@Processor(ANNOUNCEMENT_QUEUE_NAME)
export class AnnouncementProcessor extends WorkerHost {
  private readonly logger = new Logger(AnnouncementProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(delivery: Job<EnqueueAnnouncementCommand>): Promise<void> {
    const announcement = await this.prisma.announcement.findUnique({ where: { id: delivery.data.announcementId } });
    if (!announcement || announcement.status === 'SENT' || announcement.status === 'DRAFT') return;

    while (true) {
      const pending = await this.prisma.announcementRecipient.findMany({
        where: { announcementId: announcement.id, deliveredAt: null },
        orderBy: { userId: 'asc' },
        take: ANNOUNCEMENT_DELIVERY_BATCH_SIZE,
        select: { userId: true },
      });
      if (!pending.length) break;
      const userIds = pending.map(({ userId }) => userId);
      const deliveredAt = new Date();
      await this.prisma.$transaction([
        this.prisma.notification.createMany({
          data: userIds.map((userId) => ({
            userId,
            type: 'SYSTEM' as const,
            title: announcement.title,
            body: announcement.body,
            targetType: 'ANNOUNCEMENT',
            targetId: announcement.id,
            eventKey: `announcement:${announcement.id}:${userId}`,
          })),
          skipDuplicates: true,
        }),
        this.prisma.announcementRecipient.updateMany({
          where: { announcementId: announcement.id, userId: { in: userIds }, deliveredAt: null },
          data: { deliveredAt },
        }),
      ]);
    }
    await this.prisma.announcement.updateMany({
      where: { id: announcement.id, status: 'SENDING' },
      data: { status: 'SENT', sentAt: new Date() },
    });
    this.logger.log(`Announcement ${announcement.id} delivered`);
  }
}
