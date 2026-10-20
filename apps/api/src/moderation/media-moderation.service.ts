import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, MediaReviewStatus } from '@prisma/client';
import type { AdminMediaAsset, CursorPage } from '@lumi/contracts';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import type { MediaReviewKind, MediaReviewQueryDto, UpdateMediaReviewDto } from './media-moderation.dto';

type MediaRow = Prisma.MediaAssetGetPayload<{ include: { _count: { select: { generationOutputs: true } } } }>;

@Injectable()
export class MediaModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async list(query: MediaReviewQueryDto): Promise<CursorPage<AdminMediaAsset>> {
    const cursor = decodeTimestampCursor(query.cursor);
    const rows = await this.prisma.mediaAsset.findMany({
      where: {
        ...(query.status ? { reviewStatus: query.status } : {}),
        status: { in: ['READY', 'REJECTED'] },
        deletedAt: null,
        ...(cursor
          ? {
              OR: [
                { updatedAt: { lt: new Date(cursor.timestamp) } },
                { updatedAt: new Date(cursor.timestamp), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: { _count: { select: { generationOutputs: true } } },
    });
    const hasNext = rows.length > query.limit;
    const items = hasNext ? rows.slice(0, query.limit) : rows;
    const kinds = await this.resolveKinds(items);
    const filtered = query.kind ? items.filter((row) => kinds.get(row.id) === query.kind) : items;
    const last = items.at(-1);
    return {
      items: await Promise.all(filtered.map((row) => this.toContract(row, kinds.get(row.id) ?? 'UPLOAD'))),
      nextCursor:
        hasNext && last ? encodeTimestampCursor({ timestamp: last.updatedAt.toISOString(), id: last.id }) : null,
    };
  }

  async update(id: string, actorId: string, input: UpdateMediaReviewDto): Promise<AdminMediaAsset> {
    const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
    if (Number.isNaN(expectedUpdatedAt.valueOf())) throw new ConflictException('版本时间无效，请刷新后重试');
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM media_assets WHERE id = ${id} FOR UPDATE`;
      const current = await tx.mediaAsset.findUnique({
        include: { _count: { select: { generationOutputs: true } } },
        where: { id },
      });
      if (!current || current.deletedAt) throw new NotFoundException('图片素材不存在');
      if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime())
        throw new ConflictException('图片审核状态已变化，请刷新后重试');
      if (current.status !== 'READY' && current.status !== 'REJECTED')
        throw new ConflictException('图片尚未完成处理，暂不能审核');
      if (current.reviewStatus === input.status) return current;
      const result = await tx.mediaAsset.updateMany({
        where: { id, updatedAt: current.updatedAt, deletedAt: null },
        data: {
          reviewStatus: input.status,
          reviewReason: input.reason?.trim() || null,
          reviewedAt: new Date(),
          reviewedById: actorId,
          ...(input.status === MediaReviewStatus.REJECTED ? { visibility: 'PRIVATE' } : {}),
        },
      });
      if (result.count !== 1) throw new ConflictException('图片审核状态已变化，请刷新后重试');
      await tx.mediaReviewAction.create({
        data: {
          assetId: id,
          actorId,
          fromStatus: current.reviewStatus,
          toStatus: input.status,
          reason: input.reason?.trim() || null,
        },
      });
      return tx.mediaAsset.findUniqueOrThrow({
        where: { id },
        include: { _count: { select: { generationOutputs: true } } },
      });
    });
    const kinds = await this.resolveKinds([updated]);
    return this.toContract(updated, kinds.get(id) ?? 'UPLOAD');
  }

  async actions(id: string, query: MediaReviewQueryDto) {
    const cursor = decodeTimestampCursor(query.cursor);
    const rows = await this.prisma.mediaReviewAction.findMany({
      where: {
        assetId: id,
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
      take: query.limit + 1,
      select: { id: true, actorId: true, fromStatus: true, toStatus: true, reason: true, createdAt: true },
    });
    const hasNext = rows.length > query.limit;
    const items = hasNext ? rows.slice(0, query.limit) : rows;
    const last = items.at(-1);
    return {
      items: items.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      nextCursor:
        hasNext && last ? encodeTimestampCursor({ timestamp: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  private async resolveKinds(rows: MediaRow[]) {
    const ids = rows.map((row) => row.id);
    const [profiles, clothing] = await Promise.all([
      this.prisma.bodyProfileVersion.findMany({
        where: { sourceAssetId: { in: ids } },
        select: { sourceAssetId: true },
      }),
      this.prisma.clothingItem.findMany({ where: { assetId: { in: ids } }, select: { assetId: true } }),
    ]);
    const kinds = new Map<string, MediaReviewKind>();
    for (const row of rows) if (row._count.generationOutputs > 0) kinds.set(row.id, 'GENERATION_OUTPUT');
    for (const row of clothing) if (row.assetId) kinds.set(row.assetId, 'CLOTHING');
    for (const row of profiles) if (row.sourceAssetId) kinds.set(row.sourceAssetId, 'PROFILE');
    return kinds;
  }

  private async toContract(row: MediaRow, kind: MediaReviewKind): Promise<AdminMediaAsset> {
    return {
      id: row.id,
      ownerId: row.ownerId,
      kind,
      status: row.status,
      reviewStatus: row.reviewStatus,
      reviewReason: row.reviewReason,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewedById: row.reviewedById,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
      width: row.width,
      height: row.height,
      url: await this.media.readForAdmin(row),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
