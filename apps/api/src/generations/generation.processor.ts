import { Inject, Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { GenerationJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GENERATION_QUEUE_NAME, type EnqueueGenerationCommand } from './generation-queue.port';
import { GENERATION_PROVIDER, type GenerationProvider } from './generation-provider.port';

@Injectable()
@Processor(GENERATION_QUEUE_NAME)
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GENERATION_PROVIDER) private readonly provider: GenerationProvider,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<EnqueueGenerationCommand>): Promise<void> {
    const attempt = job.attemptsMade + 1;
    const maxAttempts = typeof job.opts.attempts === 'number' ? job.opts.attempts : 1;
    const claimed = await this.prisma.generationJob.updateMany({
      where: { id: job.data.jobId, userId: job.data.userId, status: GenerationJobStatus.QUEUED },
      data: {
        status: GenerationJobStatus.RUNNING,
        retryCount: attempt,
        startedAt: new Date(),
        errorCode: null,
        nextAttemptAt: null,
      },
    });

    if (claimed.count === 0) {
      const current = await this.prisma.generationJob.findUnique({ where: { id: job.data.jobId } });
      if (
        !current ||
        current.status === GenerationJobStatus.SUCCEEDED ||
        current.status === GenerationJobStatus.CANCELLED ||
        current.status === GenerationJobStatus.DEAD_LETTER
      ) {
        return;
      }
      return;
    }

    try {
      if (this.config.getOrThrow<string>('FREE_MODE') !== 'true') {
        throw new Error('GENERATION_PROVIDER_NOT_CONFIGURED');
      }
      const existingOutput = await this.prisma.generationOutput.findFirst({ where: { jobId: job.data.jobId } });
      if (existingOutput) {
        await this.prisma.generationJob.updateMany({
          where: { id: job.data.jobId, status: GenerationJobStatus.RUNNING },
          data: { status: GenerationJobStatus.SUCCEEDED, completedAt: new Date() },
        });
        return;
      }

      const generated = await this.provider.generate({
        jobId: job.data.jobId,
        userId: job.data.userId,
        profileVersionId: job.data.profileVersionId,
        clothingAssetId: job.data.clothingAssetId,
      });

      const current = await this.prisma.generationJob.findUnique({ where: { id: job.data.jobId } });
      if (!current || current.status === GenerationJobStatus.CANCELLED) return;

      await this.prisma.$transaction(async (tx) => {
        const completed = await tx.generationJob.updateMany({
          where: { id: job.data.jobId, status: GenerationJobStatus.RUNNING },
          data: {
            status: GenerationJobStatus.SUCCEEDED,
            completedAt: new Date(),
            nextAttemptAt: null,
          },
        });
        if (completed.count !== 1) return;

        const asset = await tx.mediaAsset.upsert({
          where: { objectKey: generated.objectKey },
          update: {},
          create: {
            ownerId: job.data.userId,
            objectKey: generated.objectKey,
            mimeType: generated.mimeType,
            byteSize: generated.byteSize,
            sha256: generated.sha256,
            previewData: generated.previewData,
          },
        });
        await tx.generationOutput.create({ data: { jobId: job.data.jobId, assetId: asset.id } });
        await tx.notification.create({
          data: {
            userId: job.data.userId,
            type: 'GENERATION',
            title: '试穿生成完成',
            body: '你的试穿结果已经准备好，可以在生成记录中查看。',
            targetType: 'GENERATION_JOB',
            targetId: job.data.jobId,
          },
        });
      });
    } catch (error) {
      const errorCode = this.toErrorCode(error);
      const finalAttempt = attempt >= maxAttempts;
      await this.prisma.generationJob.updateMany({
        where: { id: job.data.jobId, status: GenerationJobStatus.RUNNING },
        data: {
          status: finalAttempt ? GenerationJobStatus.DEAD_LETTER : GenerationJobStatus.QUEUED,
          errorCode,
          nextAttemptAt: finalAttempt ? null : new Date(Date.now() + this.backoffFor(attempt)),
        },
      });
      if (finalAttempt) {
        await this.prisma.notification.create({
          data: {
            userId: job.data.userId,
            type: 'GENERATION',
            title: '试穿生成失败',
            body: '本次生成失败，未产生公开内容，可以稍后重试。',
            targetType: 'GENERATION_JOB',
            targetId: job.data.jobId,
          },
        });
      }
      this.logger.error(
        `Generation job ${job.data.jobId} failed on attempt ${attempt}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private backoffFor(attempt: number): number {
    return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt - 1));
  }

  private toErrorCode(error: unknown): string {
    if (error instanceof Error && error.name.length > 0) return error.name.slice(0, 80);
    return 'GENERATION_PROVIDER_ERROR';
  }
}
