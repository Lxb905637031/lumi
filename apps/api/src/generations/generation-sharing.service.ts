import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { GenerationShare } from '@lumi/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';

const SHARE_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class GenerationSharingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async create(userId: string, jobId: string, outputId: string): Promise<GenerationShare> {
    const output = await this.prisma.generationOutput.findFirst({
      where: {
        id: outputId,
        jobId,
        job: { userId, status: 'SUCCEEDED' },
        selectedAt: { not: null },
        deletedAt: null,
        asset: { ownerId: userId, status: 'READY', deletedAt: null },
      },
      include: { job: { select: { provider: true } }, asset: true },
    });
    if (!output) throw new NotFoundException('请先确认一个可用的生成结果');

    const token = randomBytes(32).toString('base64url');
    const share = await this.prisma.generationShare.create({
      data: {
        outputId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + SHARE_TTL_MS),
      },
    });
    return this.toContract(share.id, token, share.expiresAt, output);
  }

  async read(token: string): Promise<GenerationShare> {
    if (!token || token.length > 128) throw new NotFoundException('分享链接不存在或已失效');
    const share = await this.prisma.generationShare.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        output: {
          include: {
            job: { select: { status: true, provider: true } },
            asset: true,
          },
        },
      },
    });
    if (
      !share ||
      share.revokedAt ||
      share.expiresAt <= new Date() ||
      share.output.deletedAt ||
      share.output.selectedAt === null ||
      share.output.job.status !== 'SUCCEEDED' ||
      share.output.asset.status !== 'READY' ||
      share.output.asset.deletedAt
    ) {
      throw new NotFoundException('分享链接不存在或已失效');
    }
    return this.toContract(share.id, token, share.expiresAt, share.output);
  }

  async revoke(userId: string, shareId: string) {
    const updated = await this.prisma.generationShare.updateMany({
      where: { id: shareId, output: { job: { userId } }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!updated.count) throw new NotFoundException('分享链接不存在');
    return { revoked: true };
  }

  private async toContract(
    id: string,
    token: string,
    expiresAt: Date,
    output: {
      id: string;
      assetId: string;
      createdAt: Date;
      selectedAt: Date | null;
      deletedAt: Date | null;
      asset: Parameters<MediaService['readForShare']>[0];
      job: { provider: string; status?: string };
    },
  ): Promise<GenerationShare> {
    const url = await this.media.readForShare(output.asset);
    if (!url) throw new ConflictException('图片暂不可用，请稍后重试');
    return {
      id,
      token,
      outputId: output.id,
      assetId: output.assetId,
      url,
      mimeType: output.asset.mimeType,
      expiresAt: expiresAt.toISOString(),
      developmentPreview: output.job.provider === 'local-svg',
    };
  }
}
