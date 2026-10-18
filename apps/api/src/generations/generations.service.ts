import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerationJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GenerationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(userId: string, input: { profileVersionId: string; clothingAssetId: string; idempotencyKey: string }) {
    const existing = await this.prisma.generationJob.findFirst({
      where: { userId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;

    const profileVersion = await this.prisma.bodyProfileVersion.findFirst({
      where: { id: input.profileVersionId, profile: { userId } },
    });
    if (!profileVersion) throw new NotFoundException('身材档案版本不存在');
    const clothingItem = await this.prisma.clothingItem.findFirst({ where: { id: input.clothingAssetId, userId } });
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
      if (this.config.getOrThrow<string>('FREE_MODE') === 'true') void this.simulate(job.id, userId);
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

  private async simulate(jobId: string, userId: string) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await this.prisma.generationJob.updateMany({
      where: { id: jobId, userId, status: GenerationJobStatus.QUEUED },
      data: { status: GenerationJobStatus.RUNNING },
    });
    await new Promise((resolve) => setTimeout(resolve, 650));
    const job = await this.prisma.generationJob.findFirst({ where: { id: jobId, userId } });
    if (!job || job.status !== GenerationJobStatus.RUNNING) return;
    const asset = await this.prisma.mediaAsset.create({
      data: {
        ownerId: userId,
        objectKey: `mock/generations/${jobId}.jpg`,
        mimeType: 'image/jpeg',
        byteSize: 0,
        sha256: `mock-${jobId}`,
      },
    });
    await this.prisma.$transaction([
      this.prisma.generationOutput.create({ data: { jobId, assetId: asset.id } }),
      this.prisma.generationJob.update({ where: { id: jobId }, data: { status: GenerationJobStatus.SUCCEEDED } }),
    ]);
  }

  async findOwned(userId: string, id: string) {
    const job = await this.prisma.generationJob.findFirst({
      where: { id, userId },
      include: { outputs: true },
    });
    if (!job) throw new NotFoundException('生成任务不存在');
    return job;
  }

  list(userId: string) {
    return this.prisma.generationJob.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      include: { outputs: true },
    });
  }
}
