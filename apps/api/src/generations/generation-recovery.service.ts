import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { QuotaService } from '../quota/quota.service';
import { GENERATION_QUEUE, type GenerationQueue } from './generation-queue.port';
import { GENERATION_LEASE_MS } from './generation.processor';

export const GENERATION_DISPATCH_DEADLINE_MS = 300_000;

@Injectable()
export class GenerationRecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GenerationRecoveryService.name);
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuotaService) private readonly quota: QuotaService,
    @Inject(GENERATION_QUEUE) private readonly queue: GenerationQueue,
    @Inject(ConfigService) private readonly config: ConfigService,
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
      .catch(() => this.logger.error('Generation recovery failed; durable rows retained for retry'))
      .finally(() => {
        this.active = undefined;
      });
  }

  async sweep() {
    const expired = await this.prisma.generationJob.findMany({
      where: {
        status: 'RUNNING',
        OR: [
          { leaseExpiresAt: { lte: new Date() } },
          { leaseExpiresAt: null, updatedAt: { lt: new Date(Date.now() - GENERATION_LEASE_MS) } },
        ],
      },
      orderBy: { updatedAt: 'asc' },
      take: 50,
    });
    for (const job of expired) {
      await this.prisma.$transaction(async (tx) => {
        const failed = await tx.generationJob.updateMany({
          where: {
            id: job.id,
            status: 'RUNNING',
            executionToken: job.executionToken,
            quotaAttempt: job.quotaAttempt,
            updatedAt: job.updatedAt,
          },
          data: {
            status: 'DEAD_LETTER',
            errorCode: 'EXECUTION_LEASE_EXPIRED',
            completedAt: new Date(),
            nextAttemptAt: null,
            executionToken: null,
            leaseExpiresAt: null,
          },
        });
        if (failed.count !== 1) return;
        await this.quota.release(tx, job);
        await tx.notification.create({
          data: {
            userId: job.userId,
            type: 'GENERATION',
            title: '试穿任务已中断',
            body: '任务执行中断，预留额度已释放，可手动重试。',
            targetType: 'GENERATION_JOB',
            targetId: job.id,
          },
        });
      });
    }
    // Outbox-style redispatch closes commit-before-enqueue and Redis record-loss windows.
    const due = await this.prisma.generationJob.findMany({
      where: { status: 'QUEUED', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] },
      orderBy: { updatedAt: 'asc' },
      take: 50,
    });
    for (const job of due) {
      const exhausted = job.retryCount >= this.config.getOrThrow<number>('GENERATION_QUEUE_ATTEMPTS');
      if (exhausted || job.updatedAt.getTime() < Date.now() - GENERATION_DISPATCH_DEADLINE_MS) {
        await this.prisma.$transaction(async (tx) => {
          const failed = await tx.generationJob.updateMany({
            where: { id: job.id, status: 'QUEUED', quotaAttempt: job.quotaAttempt, updatedAt: job.updatedAt },
            data: {
              status: 'DEAD_LETTER',
              errorCode: exhausted ? 'ATTEMPTS_EXHAUSTED' : 'QUEUE_DISPATCH_EXPIRED',
              nextAttemptAt: null,
              completedAt: new Date(),
            },
          });
          if (failed.count !== 1) return;
          await this.quota.release(tx, job);
          await tx.notification.create({
            data: {
              userId: job.userId,
              type: 'GENERATION',
              title: '试穿排队已超时',
              body: '任务未能及时启动，预留额度已释放，可稍后重试。',
              targetType: 'GENERATION_JOB',
              targetId: job.id,
            },
          });
        });
        continue;
      }
      try {
        await this.queue.enqueue({
          jobId: job.id,
          userId: job.userId,
          profileVersionId: job.profileVersionId,
          clothingAssetId: job.clothingAssetId,
          quotaAttempt: job.quotaAttempt,
        });
      } catch {
        this.logger.warn(`Generation ${job.id} redispatch deferred`);
      }
    }
  }
}
