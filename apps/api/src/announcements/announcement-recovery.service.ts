import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ANNOUNCEMENT_QUEUE, type AnnouncementQueue } from './announcement-queue.port';
import { queueEvent } from '../common/queue-logging';

@Injectable()
export class AnnouncementRecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnnouncementRecoveryService.name);
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ANNOUNCEMENT_QUEUE) private readonly queue: AnnouncementQueue,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.schedule(), 15_000);
    this.timer.unref();
    this.schedule();
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.active;
  }

  private schedule() {
    if (this.active) return;
    this.active = this.sweep()
      .catch(() => this.logger.error('Announcement recovery failed; durable SENDING rows retained'))
      .finally(() => {
        this.active = undefined;
      });
  }

  private async sweep() {
    const pending = await this.prisma.announcement.findMany({
      where: { status: 'SENDING' },
      orderBy: { updatedAt: 'asc' },
      take: 50,
      select: { id: true },
    });
    for (const announcement of pending) {
      try {
        await this.queue.enqueue({ announcementId: announcement.id, workflowId: announcement.id });
      } catch {
        this.logger.warn(
          queueEvent({
            event: 'queue.recovery.redispatch-deferred',
            queue: 'announcement-delivery',
            workflowId: announcement.id,
            outcome: 'deferred',
          }),
        );
      }
    }
  }
}
