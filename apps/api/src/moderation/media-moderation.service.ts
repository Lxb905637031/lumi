import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, MediaReviewStatus } from '@prisma/client';
import type { AdminMediaAsset, CursorPage } from '@lumi/contracts';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import type {
  BatchUpdateMediaReviewDto,
  MediaReviewKind,
  MediaReviewQueryDto,
  UpdateMediaReviewDto,
} from './media-moderation.dto';

type MediaRow = Prisma.MediaAssetGetPayload<{ include: { _count: { select: { generationOutputs: true } } } }>;
type ClassifiedMediaRow = { id: string; kind: MediaReviewKind; updatedAt: Date };

@Injectable()
export class MediaModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async list(query: MediaReviewQueryDto): Promise<CursorPage<AdminMediaAsset>> {
    const cursor = decodeTimestampCursor(query.cursor);
    const mediaFilters: Prisma.Sql[] = [
      Prisma.sql`m.status IN ('READY', 'REJECTED')`,
      Prisma.sql`m.deleted_at IS NULL`,
    ];
    const classifiedFilters: Prisma.Sql[] = [];
    if (query.status) mediaFilters.push(Prisma.sql`m.review_status::text = ${query.status}`);
    if (query.kind) classifiedFilters.push(Prisma.sql`classified.kind = ${query.kind}`);
    if (cursor) {
      classifiedFilters.push(
        Prisma.sql`(classified.updated_at < ${new Date(cursor.timestamp)} OR (classified.updated_at = ${new Date(cursor.timestamp)} AND classified.id < ${cursor.id}))`,
      );
    }
    const classifiedRows = await this.prisma.$queryRaw<ClassifiedMediaRow[]>(Prisma.sql`
      WITH classified AS (
        SELECT
          m.id,
          m.updated_at,
          CASE
            WHEN EXISTS (SELECT 1 FROM body_profile_versions p WHERE p.source_asset_id = m.id) THEN 'PROFILE'
            WHEN EXISTS (SELECT 1 FROM clothing_items c WHERE c.asset_id = m.id) THEN 'CLOTHING'
            WHEN EXISTS (SELECT 1 FROM generation_outputs g WHERE g.asset_id = m.id) THEN 'GENERATION_OUTPUT'
            ELSE 'UPLOAD'
          END::text AS kind
        FROM media_assets m
        WHERE ${Prisma.join(mediaFilters, ' AND ')}
      )
      SELECT classified.id, classified.kind, classified.updated_at AS "updatedAt"
      FROM classified
      ${classifiedFilters.length ? Prisma.sql`WHERE ${Prisma.join(classifiedFilters, ' AND ')}` : Prisma.empty}
      ORDER BY classified.updated_at DESC, classified.id DESC
      LIMIT ${query.limit + 1}
    `);
    const hasNext = classifiedRows.length > query.limit;
    const pageRows = hasNext ? classifiedRows.slice(0, query.limit) : classifiedRows;
    const rows = await this.prisma.mediaAsset.findMany({
      where: { id: { in: pageRows.map((row) => row.id) } },
      include: { _count: { select: { generationOutputs: true } } },
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const last = pageRows.at(-1);
    return {
      items: await Promise.all(
        pageRows.flatMap((classified) => {
          const row = rowById.get(classified.id);
          return row ? [this.toContract(row, classified.kind)] : [];
        }),
      ),
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

  async updateBatch(actorId: string, input: BatchUpdateMediaReviewDto) {
    const expected = new Map(input.items.map((item) => [item.id, new Date(item.expectedUpdatedAt)]));
    if ([...expected.values()].some((value) => Number.isNaN(value.valueOf()))) {
      throw new ConflictException('版本时间无效，请刷新后重试');
    }
    const ids = input.items.map((item) => item.id);
    const updatedRows = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM media_assets
        WHERE id IN (${Prisma.join([...ids].sort())}) AND deleted_at IS NULL
        ORDER BY id
        FOR UPDATE
      `);
      if (locked.length !== ids.length) throw new NotFoundException('图片素材不存在或已删除，请刷新后重试');
      const rows = await tx.mediaAsset.findMany({
        where: { id: { in: ids }, deletedAt: null },
        include: { _count: { select: { generationOutputs: true } } },
      });
      const byId = new Map(rows.map((row) => [row.id, row]));
      const changed: MediaRow[] = [];
      let skippedCount = 0;
      for (const id of ids) {
        const current = byId.get(id);
        if (!current) throw new NotFoundException('图片素材不存在或已删除，请刷新后重试');
        const expectedUpdatedAt = expected.get(id);
        if (!expectedUpdatedAt || current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
          throw new ConflictException('图片审核状态已变化，请刷新后重试');
        }
        if (current.status !== 'READY' && current.status !== 'REJECTED') {
          throw new ConflictException('图片尚未完成处理，暂不能审核');
        }
        if (current.reviewStatus === input.status) {
          skippedCount += 1;
          changed.push(current);
          continue;
        }
        const updated = await tx.mediaAsset.update({
          where: { id },
          data: {
            reviewStatus: input.status,
            reviewReason: input.reason?.trim() || null,
            reviewedAt: new Date(),
            reviewedById: actorId,
            ...(input.status === MediaReviewStatus.REJECTED ? { visibility: 'PRIVATE' } : {}),
          },
          include: { _count: { select: { generationOutputs: true } } },
        });
        await tx.mediaReviewAction.create({
          data: {
            assetId: id,
            actorId,
            fromStatus: current.reviewStatus,
            toStatus: input.status,
            reason: input.reason?.trim() || null,
          },
        });
        changed.push(updated);
      }
      return { changed, updatedCount: ids.length - skippedCount, skippedCount };
    });
    const kinds = await this.resolveKinds(updatedRows.changed);
    return {
      items: await Promise.all(updatedRows.changed.map((row) => this.toContract(row, kinds.get(row.id) ?? 'UPLOAD'))),
      updatedCount: updatedRows.updatedCount,
      skippedCount: updatedRows.skippedCount,
    };
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
      items: items.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
      })),
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
