import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CursorPage } from '@lumi/contracts';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditQueryDto } from './audit.dto';

type AuditRow = {
  id: string;
  type: string;
  targetId: string;
  actorId: string | null;
  fromStatus: string;
  toStatus: string;
  reason: string | null;
  createdAt: Date;
};

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const [pendingPosts, generationToday, failedGenerations, communityPosts, openReports] = await Promise.all([
      this.prisma.post.count({ where: { moderationStatus: 'PENDING', deletedAt: null } }),
      this.prisma.generationJob.count({ where: { createdAt: { gte: dayStart } } }),
      this.prisma.generationJob.count({ where: { status: { in: ['FAILED', 'DEAD_LETTER'] } } }),
      this.prisma.post.count({ where: { deletedAt: null } }),
      this.prisma.postReport.count({ where: { status: 'OPEN' } }),
    ]);
    return { pendingPosts, generationToday, failedGenerations, communityPosts, openReports };
  }

  async listAudit(query: AuditQueryDto): Promise<CursorPage<AuditRow>> {
    const cursor = decodeTimestampCursor(query.cursor);
    const filters: Prisma.Sql[] = [];
    if (query.type) filters.push(Prisma.sql`audit.type = ${query.type}`);
    if (query.actorId?.trim()) filters.push(Prisma.sql`audit.actor_id = ${query.actorId.trim()}`);
    if (query.targetId?.trim()) filters.push(Prisma.sql`audit.target_id = ${query.targetId.trim()}`);
    let cursorId: string | undefined;
    let cursorType: string | undefined;
    if (cursor) {
      const splitAt = cursor.id.lastIndexOf(':');
      if (splitAt <= 0 || splitAt === cursor.id.length - 1) throw new BadRequestException('分页游标无效');
      cursorId = cursor.id.slice(0, splitAt);
      cursorType = cursor.id.slice(splitAt + 1);
      if (!['POST', 'COMMENT', 'MEDIA', 'USER'].includes(cursorType)) throw new BadRequestException('分页游标无效');
      filters.push(
        Prisma.sql`(audit.created_at < ${new Date(cursor.timestamp)} OR (audit.created_at = ${new Date(cursor.timestamp)} AND (audit.id < ${cursorId} OR (audit.id = ${cursorId} AND audit.type > ${cursorType}))))`,
      );
    }
    const where = filters.length ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<AuditRow[]>(Prisma.sql`
      SELECT audit.id, audit.type, audit.target_id AS "targetId", audit.actor_id AS "actorId",
             audit.from_status AS "fromStatus", audit.to_status AS "toStatus",
             audit.reason, audit.created_at AS "createdAt"
      FROM (
        SELECT id, 'POST'::text AS type, post_id AS target_id, actor_id, from_status::text, to_status::text, reason, created_at
        FROM moderation_actions
        UNION ALL
        SELECT id, 'COMMENT'::text AS type, comment_id AS target_id, actor_id, from_status::text, to_status::text, reason, created_at
        FROM comment_moderation_actions
        UNION ALL
        SELECT id, 'MEDIA'::text AS type, asset_id AS target_id, actor_id, from_status::text, to_status::text, reason, created_at
        FROM media_review_actions
        UNION ALL
        SELECT id, 'USER'::text AS type, user_id AS target_id, actor_id,
               concat_ws(' / ', from_status::text, from_role::text) AS from_status,
               concat_ws(' / ', to_status::text, to_role::text) AS to_status,
               reason, created_at
        FROM user_moderation_actions
      ) AS audit
      ${where}
      ORDER BY audit.created_at DESC, audit.id DESC, audit.type ASC
      LIMIT ${query.limit + 1}
    `);
    const hasNext = rows.length > query.limit;
    const items = hasNext ? rows.slice(0, query.limit) : rows;
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasNext && last
          ? encodeTimestampCursor({ timestamp: last.createdAt.toISOString(), id: `${last.id}:${last.type}` })
          : null,
    };
  }
}
