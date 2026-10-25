import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  ANNOUNCEMENT_DELIVERY_BATCH_SIZE,
  ANNOUNCEMENT_QUEUE_NAME,
  type EnqueueAnnouncementCommand,
} from './announcement-queue.port';
import { queueEvent, safeErrorCode } from '../common/queue-logging';
import { RuntimeMetricsService } from '../common/runtime-metrics.service';

@Injectable()
@Processor(ANNOUNCEMENT_QUEUE_NAME)
export class AnnouncementProcessor extends WorkerHost {
  private readonly logger = new Logger(AnnouncementProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(RuntimeMetricsService) private readonly metrics: RuntimeMetricsService,
  ) {
    super();
  }

  async process(delivery: Job<EnqueueAnnouncementCommand>): Promise<void> {
    const workflowId = delivery.data.workflowId ?? delivery.data.announcementId;
    const requestId = delivery.data.requestId;
    const attempt = delivery.attemptsMade + 1;
    this.metrics.recordQueue(ANNOUNCEMENT_QUEUE_NAME, 'started');
    this.logger.log(
      queueEvent({
        event: 'queue.process.started',
        queue: ANNOUNCEMENT_QUEUE_NAME,
        bullJobId: String(delivery.id),
        requestId,
        workflowId,
        attempt,
      }),
    );
    try {
      const announcement = await this.prisma.announcement.findUnique({ where: { id: delivery.data.announcementId } });
      if (!announcement || announcement.status === 'SENT' || announcement.status === 'DRAFT') {
        this.metrics.recordQueue(ANNOUNCEMENT_QUEUE_NAME, 'skipped');
        this.logger.log(
          queueEvent({
            event: 'queue.process.skipped',
            queue: ANNOUNCEMENT_QUEUE_NAME,
            bullJobId: String(delivery.id),
            requestId,
            workflowId,
            attempt,
            outcome: 'stale-or-terminal',
          }),
        );
        return;
      }

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
      this.logger.log(
        queueEvent({
          event: 'queue.process.completed',
          queue: ANNOUNCEMENT_QUEUE_NAME,
          bullJobId: String(delivery.id),
          requestId,
          workflowId,
          attempt,
          outcome: 'succeeded',
        }),
      );
      this.metrics.recordQueue(ANNOUNCEMENT_QUEUE_NAME, 'succeeded');
    } catch (error) {
      this.logger.error(
        queueEvent({
          event: 'queue.process.failed',
          queue: ANNOUNCEMENT_QUEUE_NAME,
          bullJobId: String(delivery.id),
          requestId,
          workflowId,
          attempt,
          outcome: 'retrying',
          errorCode: safeErrorCode(error),
        }),
      );
      this.metrics.recordQueue(ANNOUNCEMENT_QUEUE_NAME, 'retrying');
      throw error;
    }
  }
}
