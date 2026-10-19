import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { GenerationJobStatus } from '@prisma/client';
import type { CursorPage, GenerationJob } from '@lumi/contracts';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { CursorPaginationDto } from '../common/pagination/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QuotaService } from '../quota/quota.service';
import { GENERATION_QUEUE, type GenerationQueue } from './generation-queue.port';

type GenerationJobRecord = Prisma.GenerationJobGetPayload<{
  include: {
    outputs: {
      include: {
        asset: {
          select: {
            id: true;
            mimeType: true;
            byteSize: true;
            visibility: true;
            previewData: true;
            status: true;
            deletedAt: true;
          };
        };
      };
    };
  };
}>;

@Injectable()
export class GenerationsService {
  private readonly logger = new Logger(GenerationsService.name);
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(QuotaService) private readonly quota: QuotaService,
    @Inject(GENERATION_QUEUE) private readonly generationQueue: GenerationQueue,
  ) {}

  async create(
    userId: string,
    input: {
      profileVersionId: string;
      clothingAssetId: string;
      idempotencyKey: string;
    },
  ): Promise<GenerationJob> {
    if (this.config.getOrThrow<string>('FREE_MODE') !== 'true') {
      throw new ServiceUnavailableException('真实试穿生成服务尚未配置');
    }

    const job = await this.prisma.$transaction(async (tx) => {
      // Serialize creates/retries by owner, including same-key requests, before reading inputs.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR NO KEY UPDATE`;
      const existing = await tx.generationJob.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
        include: { outputs: { include: { asset: { select: this.assetSelect() } } } },
      });
      if (existing) {
        if (
          existing.profileVersionId !== input.profileVersionId ||
          existing.clothingAssetId !== input.clothingAssetId
        ) {
          throw new ConflictException('幂等键已用于不同的生成输入');
        }
        return existing;
      }
      const profileVersion = await tx.bodyProfileVersion.findFirst({
        where: { id: input.profileVersionId, profile: { userId, archivedAt: null } },
      });
      if (!profileVersion) throw new NotFoundException('身材档案版本不存在');
      const clothingItem = await tx.clothingItem.findFirst({
        where: { id: input.clothingAssetId, userId, deletedAt: null },
      });
      if (!clothingItem) throw new NotFoundException('衣物资料不存在');

      const assetIds = [profileVersion.sourceAssetId, clothingItem.assetId].filter((id): id is string => !!id);
      const assets = await tx.mediaAsset.findMany({
        where: { id: { in: assetIds }, ownerId: userId, status: 'READY', deletedAt: null },
        select: { id: true, sha256: true, mimeType: true, storageDriver: true, objectKey: true },
      });
      if (assets.length !== new Set(assetIds).size) throw new ConflictException('生成输入图片已不可用');
      const created = await tx.generationJob.create({
        data: {
          userId,
          profileVersionId: input.profileVersionId,
          clothingAssetId: input.clothingAssetId,
          idempotencyKey: input.idempotencyKey,
          status: GenerationJobStatus.QUEUED,
          provider: 'local-svg',
          quotaAttempt: 1,
          inputSnapshot: {
            schemaVersion: 1,
            profile: {
              id: profileVersion.id,
              profileId: profileVersion.profileId,
              version: profileVersion.version,
              measurements: profileVersion.measurements as Prisma.InputJsonValue,
              sourceAssetId: profileVersion.sourceAssetId,
            },
            clothing: {
              id: clothingItem.id,
              name: clothingItem.name,
              category: clothingItem.category,
              color: clothingItem.color,
              style: clothingItem.style,
              assetId: clothingItem.assetId,
            },
            assets,
          },
        },
        include: { outputs: { include: { asset: { select: this.assetSelect() } } } },
      });
      await this.quota.reserve(tx, created);
      return created;
    });
    if (job.status === GenerationJobStatus.QUEUED) await this.ensureEnqueued(job);
    return this.findOwned(userId, job.id);
  }

  async findOwned(userId: string, id: string): Promise<GenerationJob> {
    const job = await this.findOwnedRecord(userId, id);
    return this.toContract(job);
  }

  async list(userId: string, pagination: CursorPaginationDto): Promise<CursorPage<GenerationJob>> {
    const cursor = decodeTimestampCursor(pagination.cursor);
    const jobs = await this.prisma.generationJob.findMany({
      where: {
        userId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.timestamp) } },
                { createdAt: new Date(cursor.timestamp), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pagination.limit + 1,
      include: { outputs: { include: { asset: { select: this.assetSelect() } } } },
    });
    const hasNextPage = jobs.length > pagination.limit;
    const items = (hasNextPage ? jobs.slice(0, pagination.limit) : jobs).map((job) => this.toContract(job));
    const last = jobs.at(Math.min(jobs.length, pagination.limit) - 1);
    return {
      items,
      nextCursor:
        hasNextPage && last ? encodeTimestampCursor({ timestamp: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async retry(userId: string, id: string): Promise<GenerationJob> {
    if (this.config.getOrThrow<string>('FREE_MODE') !== 'true')
      throw new ServiceUnavailableException('真实试穿生成服务尚未配置');
    const current = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR NO KEY UPDATE`;
      const current = await tx.generationJob.findFirst({ where: { id, userId } });
      if (!current) throw new NotFoundException('生成任务不存在');
      if (current.status === GenerationJobStatus.QUEUED || current.status === GenerationJobStatus.RUNNING)
        return current;
      if (current.status !== GenerationJobStatus.FAILED && current.status !== GenerationJobStatus.DEAD_LETTER) {
        throw new ConflictException('只有失败或死信任务可以重试');
      }
      const updated = await tx.generationJob.updateMany({
        where: {
          id,
          userId,
          status: { in: [GenerationJobStatus.FAILED, GenerationJobStatus.DEAD_LETTER] },
        },
        data: {
          status: GenerationJobStatus.QUEUED,
          retryCount: 0,
          errorCode: null,
          nextAttemptAt: new Date(),
          startedAt: null,
          completedAt: null,
          executionToken: null,
          leaseExpiresAt: null,
          quotaAttempt: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException('任务状态已变化，请刷新');
      const retried = await tx.generationJob.findUniqueOrThrow({ where: { id } });
      await this.quota.reserve(tx, retried);
      return retried;
    });
    if (current.status === GenerationJobStatus.QUEUED) await this.ensureEnqueued(current);
    return this.findOwned(userId, id);
  }

  async cancel(userId: string, id: string): Promise<GenerationJob> {
    const current = await this.findOwnedRecord(userId, id);
    if (current.status === GenerationJobStatus.CANCELLED) return this.toContract(current);
    if (current.status !== GenerationJobStatus.QUEUED && current.status !== GenerationJobStatus.RUNNING) {
      throw new ConflictException('当前任务状态不支持取消');
    }
    await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.generationJob.updateMany({
        where: {
          id,
          userId,
          quotaAttempt: current.quotaAttempt,
          status: { in: [GenerationJobStatus.QUEUED, GenerationJobStatus.RUNNING] },
        },
        data: {
          status: GenerationJobStatus.CANCELLED,
          nextAttemptAt: null,
          completedAt: new Date(),
          executionToken: null,
          leaseExpiresAt: null,
        },
      });
      if (cancelled.count === 1) await this.quota.release(tx, current);
    });
    // DB cancellation fences the worker even if Redis cannot remove an active record.
    try {
      await this.generationQueue.cancel(id, current.quotaAttempt);
    } catch {
      this.logger.warn(`Queue removal deferred for cancelled generation ${id}`);
    }
    return this.findOwned(userId, id);
  }

  private async ensureEnqueued(job: {
    id: string;
    userId: string;
    profileVersionId: string;
    clothingAssetId: string;
    quotaAttempt: number;
  }): Promise<void> {
    try {
      await this.generationQueue.enqueue({
        jobId: job.id,
        userId: job.userId,
        profileVersionId: job.profileVersionId,
        clothingAssetId: job.clothingAssetId,
        quotaAttempt: job.quotaAttempt,
      });
    } catch {
      const failed = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.generationJob.updateMany({
          where: { id: job.id, userId: job.userId, quotaAttempt: job.quotaAttempt, status: GenerationJobStatus.QUEUED },
          data: {
            status: GenerationJobStatus.FAILED,
            errorCode: 'QUEUE_UNAVAILABLE',
            completedAt: new Date(),
            nextAttemptAt: null,
          },
        });
        if (updated.count === 1) await this.quota.release(tx, job);
        return updated.count === 1;
      });
      if (failed) throw new ServiceUnavailableException('生成队列暂时不可用，预留额度已释放，请稍后重试');
    }
  }

  private async findOwnedRecord(userId: string, id: string): Promise<GenerationJobRecord> {
    const job = await this.prisma.generationJob.findFirst({
      where: { id, userId },
      include: { outputs: { include: { asset: { select: this.assetSelect() } } } },
    });
    if (!job) throw new NotFoundException('生成任务不存在');
    return job;
  }

  private toContract(job: GenerationJobRecord): GenerationJob {
    return {
      id: job.id,
      status: job.status,
      provider: job.provider,
      retryCount: job.retryCount,
      errorCode: job.errorCode,
      nextAttemptAt: job.nextAttemptAt?.toISOString() ?? null,
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      outputs: job.outputs
        .filter((output) => !output.deletedAt && !output.asset.deletedAt && output.asset.status === 'READY')
        .map((output) => ({
          id: output.id,
          assetId: output.asset.id,
          mimeType: output.asset.mimeType,
          byteSize: output.asset.byteSize,
          visibility: output.asset.visibility,
          previewData: output.asset.previewData,
          selectedAt: output.selectedAt?.toISOString() ?? null,
          savedAt: output.savedAt?.toISOString() ?? null,
          createdAt: output.createdAt.toISOString(),
        })),
    };
  }

  private assetSelect() {
    return {
      id: true,
      mimeType: true,
      byteSize: true,
      visibility: true,
      previewData: true,
      status: true,
      deletedAt: true,
    } as const;
  }
}
