import { ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { GenerationJobStatus } from '@prisma/client';
import type { CursorPage, GenerationJob } from '@lumi/contracts';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { CursorPaginationDto } from '../common/pagination/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
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
          };
        };
      };
    };
  };
}>;

@Injectable()
export class GenerationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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
    const existing = await this.findByIdempotencyKey(userId, input.idempotencyKey);
    if (existing) {
      if (existing.status === GenerationJobStatus.QUEUED) {
        await this.ensureEnqueued(existing.id, userId, existing);
      }
      return this.toContract(existing);
    }

    if (this.config.getOrThrow<string>('FREE_MODE') !== 'true') {
      throw new ServiceUnavailableException('真实试穿生成服务尚未配置');
    }

    const profileVersion = await this.prisma.bodyProfileVersion.findFirst({
      where: { id: input.profileVersionId, profile: { userId } },
    });
    if (!profileVersion) throw new NotFoundException('身材档案版本不存在');
    const clothingItem = await this.prisma.clothingItem.findFirst({
      where: { id: input.clothingAssetId, userId },
    });
    if (!clothingItem) throw new NotFoundException('衣物资料不存在');

    let job: GenerationJobRecord;
    try {
      job = await this.prisma.generationJob.create({
        data: {
          userId,
          profileVersionId: input.profileVersionId,
          clothingAssetId: input.clothingAssetId,
          idempotencyKey: input.idempotencyKey,
          status: GenerationJobStatus.QUEUED,
          provider: 'local-svg',
        },
        include: { outputs: { include: { asset: { select: this.assetSelect() } } } },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const raceWinner = await this.findByIdempotencyKey(userId, input.idempotencyKey);
        if (raceWinner) return this.toContract(raceWinner);
      }
      throw new ConflictException('生成任务创建失败，请稍后重试');
    }

    await this.ensureEnqueued(job.id, userId, job);
    return this.toContract(job);
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
    const current = await this.findOwnedRecord(userId, id);
    if (current.status !== GenerationJobStatus.FAILED && current.status !== GenerationJobStatus.DEAD_LETTER) {
      throw new ConflictException('只有失败或死信任务可以重试');
    }
    const updated = await this.prisma.generationJob.updateMany({
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
      },
    });
    if (updated.count !== 1) return this.findOwned(userId, id);

    try {
      await this.generationQueue.retry({
        jobId: id,
        userId,
        profileVersionId: current.profileVersionId,
        clothingAssetId: current.clothingAssetId,
      });
    } catch {
      await this.prisma.generationJob.updateMany({
        where: { id, userId, status: GenerationJobStatus.QUEUED },
        data: { status: GenerationJobStatus.FAILED, errorCode: 'QUEUE_UNAVAILABLE' },
      });
      throw new ServiceUnavailableException('生成队列暂时不可用，请稍后重试');
    }
    return this.findOwned(userId, id);
  }

  async cancel(userId: string, id: string): Promise<GenerationJob> {
    const current = await this.findOwnedRecord(userId, id);
    if (current.status === GenerationJobStatus.CANCELLED) return this.toContract(current);
    if (current.status !== GenerationJobStatus.QUEUED && current.status !== GenerationJobStatus.RUNNING) {
      throw new ConflictException('当前任务状态不支持取消');
    }
    await this.prisma.generationJob.updateMany({
      where: { id, userId, status: { in: [GenerationJobStatus.QUEUED, GenerationJobStatus.RUNNING] } },
      data: { status: GenerationJobStatus.CANCELLED, nextAttemptAt: null, completedAt: new Date() },
    });
    await this.generationQueue.cancel(id);
    return this.findOwned(userId, id);
  }

  private async ensureEnqueued(id: string, userId: string, job: GenerationJobRecord): Promise<void> {
    try {
      await this.generationQueue.enqueue({
        jobId: id,
        userId,
        profileVersionId: job.profileVersionId,
        clothingAssetId: job.clothingAssetId,
      });
    } catch {
      await this.prisma.generationJob.updateMany({
        where: { id, userId, status: GenerationJobStatus.QUEUED },
        data: { status: GenerationJobStatus.FAILED, errorCode: 'QUEUE_UNAVAILABLE' },
      });
      throw new ServiceUnavailableException('生成队列暂时不可用，请稍后重试');
    }
  }

  private findByIdempotencyKey(userId: string, idempotencyKey: string) {
    return this.prisma.generationJob.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: { outputs: { include: { asset: { select: this.assetSelect() } } } },
    });
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
      outputs: job.outputs.map((output) => ({
        id: output.id,
        assetId: output.asset.id,
        mimeType: output.asset.mimeType,
        byteSize: output.asset.byteSize,
        visibility: output.asset.visibility,
        previewData: output.asset.previewData,
        selectedAt: output.selectedAt?.toISOString() ?? null,
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
    } as const;
  }

  private isUniqueViolation(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
