import { ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { GenerationJobStatus } from '@prisma/client';
import type { CursorPage } from '@lumi/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { CursorPaginationDto } from '../common/pagination/pagination.dto';
import { GENERATION_QUEUE, type GenerationQueue } from './generation-queue.port';

type GenerationJobListItem = Prisma.GenerationJobGetPayload<{
  include: { outputs: true };
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
  ) {
    const existing = await this.prisma.generationJob.findFirst({
      where: { userId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;

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

    try {
      const job = await this.prisma.generationJob.create({
        data: {
          userId,
          profileVersionId: input.profileVersionId,
          clothingAssetId: input.clothingAssetId,
          idempotencyKey: input.idempotencyKey,
          status: GenerationJobStatus.QUEUED,
          provider: 'mock',
        },
      });
      await this.generationQueue.enqueue({ jobId: job.id, userId });
      return job;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        const raceWinner = await this.prisma.generationJob.findFirst({
          where: { userId, idempotencyKey: input.idempotencyKey },
        });
        if (raceWinner) return raceWinner;
      }
      throw new ConflictException('生成任务创建失败，请稍后重试');
    }
  }

  async findOwned(userId: string, id: string) {
    const job = await this.prisma.generationJob.findFirst({
      where: { id, userId },
      include: { outputs: true },
    });
    if (!job) throw new NotFoundException('生成任务不存在');
    return job;
  }

  async list(userId: string, pagination: CursorPaginationDto): Promise<CursorPage<GenerationJobListItem>> {
    const cursor = decodeTimestampCursor(pagination.cursor);
    const jobs = await this.prisma.generationJob.findMany({
      where: {
        userId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.timestamp) } },
                {
                  createdAt: new Date(cursor.timestamp),
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pagination.limit + 1,
      include: { outputs: true },
    });
    const hasNextPage = jobs.length > pagination.limit;
    const items = hasNextPage ? jobs.slice(0, pagination.limit) : jobs;
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasNextPage && last
          ? encodeTimestampCursor({
              timestamp: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }
}
