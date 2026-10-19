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
    await this.queue.add(GENERATION_JOB_NAME, command, {
      jobId: command.jobId,
      attempts: this.attempts,
      backoff: { type: 'exponential', delay: this.backoffDelay },
      removeOnComplete: { count: 1000 },
      removeOnFail: false,
    });
  }

  async retry(command: EnqueueGenerationCommand): Promise<void> {
    await this.queue.remove(command.jobId);
    await this.enqueue(command);
  }

  async cancel(jobId: string): Promise<void> {
    await this.queue.remove(jobId);
  }
}
