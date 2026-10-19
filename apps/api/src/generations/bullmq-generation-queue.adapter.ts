import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import {
  GENERATION_JOB_NAME,
  GENERATION_QUEUE_NAME,
  type EnqueueGenerationCommand,
  type GenerationQueue,
} from './generation-queue.port';

@Injectable()
export class BullMqGenerationQueueAdapter implements GenerationQueue {
  private readonly attempts: number;
  private readonly backoffDelay: number;

  constructor(
    @InjectQueue(GENERATION_QUEUE_NAME) private readonly queue: Queue<EnqueueGenerationCommand>,
    config: ConfigService,
  ) {
    this.attempts = config.getOrThrow<number>('GENERATION_QUEUE_ATTEMPTS');
    this.backoffDelay = config.getOrThrow<number>('GENERATION_QUEUE_BACKOFF_MS');
  }

  async enqueue(command: EnqueueGenerationCommand): Promise<void> {
    await this.bounded(this.publish(command));
  }

  private async publish(command: EnqueueGenerationCommand): Promise<void> {
    const jobId = this.queueId(command.jobId, command.quotaAttempt);
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      // DB remains authoritative; a durable QUEUED row may outlive its Redis record.
      if (state === 'completed' || state === 'failed') await existing.remove();
    }
    await this.queue.add(GENERATION_JOB_NAME, command, {
      jobId,
      attempts: this.attempts,
      backoff: { type: 'exponential', delay: this.backoffDelay },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    });
  }

  async retry(command: EnqueueGenerationCommand): Promise<void> {
    // Manual attempts have distinct IDs: never remove/replace a still-active old worker.
    await this.enqueue(command);
  }

  async cancel(jobId: string, quotaAttempt?: number): Promise<void> {
    await this.bounded(this.queue.remove(this.queueId(jobId, quotaAttempt)));
  }

  private async bounded<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('GENERATION_QUEUE_TIMEOUT')), 5000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  private queueId(jobId: string, quotaAttempt = 0): string {
    return quotaAttempt === 0 ? jobId : `${jobId}-attempt-${quotaAttempt}`;
  }
}
