import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import {
  ANNOUNCEMENT_JOB_NAME,
  ANNOUNCEMENT_QUEUE_NAME,
  type AnnouncementQueue,
  type EnqueueAnnouncementCommand,
} from './announcement-queue.port';

@Injectable()
export class BullMqAnnouncementQueueAdapter implements AnnouncementQueue {
  private readonly attempts: number;
  private readonly backoffDelay: number;

  constructor(
    @InjectQueue(ANNOUNCEMENT_QUEUE_NAME) private readonly queue: Queue<EnqueueAnnouncementCommand>,
    config: ConfigService,
  ) {
    this.attempts = config.getOrThrow<number>('ANNOUNCEMENT_QUEUE_ATTEMPTS');
    this.backoffDelay = config.getOrThrow<number>('ANNOUNCEMENT_QUEUE_BACKOFF_MS');
  }

  async enqueue(command: EnqueueAnnouncementCommand): Promise<void> {
    const job = await this.queue.getJob(command.announcementId);
    if (job) {
      const state = await job.getState();
      if (state === 'active' || state === 'waiting' || state === 'delayed') return;
      await job.remove();
    }
    await this.queue.add(ANNOUNCEMENT_JOB_NAME, command, {
      jobId: command.announcementId,
      attempts: this.attempts,
      backoff: { type: 'exponential', delay: this.backoffDelay },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    });
  }
}
