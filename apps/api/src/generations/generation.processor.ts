import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QuotaService } from '../quota/quota.service';
import { GENERATION_QUEUE_NAME, type EnqueueGenerationCommand } from './generation-queue.port';
import { GENERATION_PROVIDER, type GeneratedAsset, type GenerationProvider } from './generation-provider.port';
import { queueEvent, safeErrorCode } from '../common/queue-logging';
import { RuntimeMetricsService } from '../common/runtime-metrics.service';

// Only the development provider is wired. Real providers need timeout/cancellation acceptance.
export const GENERATION_LEASE_MS = 120_000;
export const GENERATION_TIMEOUT_MS = 60_000;

@Injectable()
@Processor(GENERATION_QUEUE_NAME)
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GENERATION_PROVIDER) private readonly provider: GenerationProvider,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(QuotaService) private readonly quota: QuotaService,
    @Inject(RuntimeMetricsService) private readonly metrics: RuntimeMetricsService,
  ) {
    super();
  }

  async process(delivery: Job<EnqueueGenerationCommand>): Promise<void> {
    const workflowId = delivery.data.workflowId ?? delivery.data.jobId;
    const requestId = delivery.data.requestId;
    const attempt = delivery.attemptsMade + 1;
    this.metrics.recordQueue(GENERATION_QUEUE_NAME, 'started');
    this.logger.log(
      queueEvent({
        event: 'queue.process.started',
        queue: GENERATION_QUEUE_NAME,
        bullJobId: String(delivery.id),
        requestId,
        workflowId,
        attempt,
      }),
    );
    const token = randomUUID();
    const maxAttempts = this.config.getOrThrow<number>('GENERATION_QUEUE_ATTEMPTS');
    const job = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.generationJob.updateMany({
        where: {
          id: delivery.data.jobId,
          userId: delivery.data.userId,
          quotaAttempt: delivery.data.quotaAttempt ?? 0,
          status: 'QUEUED',
          retryCount: { lt: maxAttempts },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
        },
        data: {
          status: 'RUNNING',
          retryCount: { increment: 1 },
          startedAt: new Date(),
          errorCode: null,
          nextAttemptAt: null,
          executionToken: token,
          leaseExpiresAt: new Date(Date.now() + GENERATION_LEASE_MS),
        },
      });
      return claimed.count === 1 ? tx.generationJob.findUniqueOrThrow({ where: { id: delivery.data.jobId } }) : null;
    });
    if (!job) {
      this.metrics.recordQueue(GENERATION_QUEUE_NAME, 'skipped');
      this.logger.log(
        queueEvent({
          event: 'queue.process.skipped',
          queue: GENERATION_QUEUE_NAME,
          bullJobId: String(delivery.id),
          requestId,
          workflowId,
          attempt,
          outcome: 'stale-or-duplicate',
        }),
      );
      return;
    }

    const running = {
      id: job.id,
      userId: job.userId,
      status: 'RUNNING' as const,
      executionToken: token,
      quotaAttempt: job.quotaAttempt,
    };
    try {
      if (this.config.getOrThrow<string>('FREE_MODE') !== 'true') throw new Error('GENERATION_PROVIDER_NOT_CONFIGURED');
      const existingOutput = await this.prisma.generationOutput.findFirst({ where: { jobId: job.id } });
      let generated: GeneratedAsset | undefined;
      if (!existingOutput) {
        const abort = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          generated = await Promise.race([
            this.provider.generate({
              jobId: job.id,
              userId: job.userId,
              profileVersionId: job.profileVersionId,
              clothingAssetId: job.clothingAssetId,
              inputSnapshot: job.inputSnapshot,
              signal: abort.signal,
            }),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                abort.abort();
                const error = new Error('Generation provider timed out');
                error.name = 'GENERATION_TIMEOUT';
                reject(error);
              }, GENERATION_TIMEOUT_MS);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      }
      await this.prisma.$transaction(async (tx) => {
        const completed = await tx.generationJob.updateMany({
          where: { ...running, leaseExpiresAt: { gt: new Date() } },
          data: {
            status: 'SUCCEEDED',
            completedAt: new Date(),
            nextAttemptAt: null,
            executionToken: null,
            leaseExpiresAt: null,
          },
        });
        if (completed.count !== 1) return;
        await this.quota.consume(tx, job);
        if (generated) {
          const asset = await tx.mediaAsset.upsert({
            where: { objectKey: generated.objectKey },
            update: {},
            create: {
              ownerId: job.userId,
              objectKey: generated.objectKey,
              mimeType: generated.mimeType,
              byteSize: generated.byteSize,
              sha256: generated.sha256,
              previewData: generated.previewData,
            },
          });
          await tx.generationOutput.create({ data: { jobId: job.id, assetId: asset.id } });
        }
        await tx.notification.create({
          data: {
            userId: job.userId,
            type: 'GENERATION',
            title: '试穿生成完成',
            body: '你的试穿结果已经准备好，可以在生成记录中查看。',
            targetType: 'GENERATION_JOB',
            targetId: job.id,
          },
        });
      });
      this.logger.log(
        queueEvent({
          event: 'queue.process.completed',
          queue: GENERATION_QUEUE_NAME,
          bullJobId: String(delivery.id),
          requestId,
          workflowId,
          attempt: job.retryCount,
          outcome: 'succeeded',
        }),
      );
      this.metrics.recordQueue(GENERATION_QUEUE_NAME, 'succeeded');
    } catch (error) {
      const finalAttempt = job.retryCount >= maxAttempts;
      const errorCode = safeErrorCode(error);
      await this.prisma.$transaction(async (tx) => {
        const failed = await tx.generationJob.updateMany({
          where: { ...running, leaseExpiresAt: { gt: new Date() } },
          data: {
            status: finalAttempt ? 'DEAD_LETTER' : 'QUEUED',
            errorCode,
            nextAttemptAt: finalAttempt ? null : new Date(Date.now() + this.backoffFor(job.retryCount)),
            completedAt: finalAttempt ? new Date() : null,
            executionToken: null,
            leaseExpiresAt: null,
          },
        });
        if (failed.count !== 1) return;
        if (finalAttempt) {
          await this.quota.release(tx, job);
          await tx.notification.create({
            data: {
              userId: job.userId,
              type: 'GENERATION',
              title: '试穿生成失败',
              body: '本次生成失败，预留额度已释放，可以稍后重试。',
              targetType: 'GENERATION_JOB',
              targetId: job.id,
            },
          });
        }
      });
      this.logger.error(
        queueEvent({
          event: 'queue.process.failed',
          queue: GENERATION_QUEUE_NAME,
          bullJobId: String(delivery.id),
          requestId,
          workflowId,
          attempt: job.retryCount,
          outcome: finalAttempt ? 'dead-letter' : 'retrying',
          errorCode,
        }),
      );
      this.metrics.recordQueue(GENERATION_QUEUE_NAME, finalAttempt ? 'dead-letter' : 'retrying');
      throw error;
    }
  }

  private backoffFor(attempt: number): number {
    return Math.min(
      60_000,
      this.config.getOrThrow<number>('GENERATION_QUEUE_BACKOFF_MS') * 2 ** Math.max(0, attempt - 1),
    );
  }
}
