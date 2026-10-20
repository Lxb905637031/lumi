import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CursorPage, ReportQueueItem } from '@lumi/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { ReportQueueQueryDto, UpdateReportStatusDto } from './moderation.dto';

type ReportRow = Prisma.PostReportGetPayload<{
  include: { post: { select: { id: true; title: true; body: true } } };
}>;

@Injectable()
export class ReportModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ReportQueueQueryDto): Promise<CursorPage<ReportQueueItem>> {
    const cursor = decodeTimestampCursor(query.cursor);
    const rows = await this.prisma.postReport.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
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
      include: { post: { select: { id: true, title: true, body: true } } },
    });
    const hasNext = rows.length > query.limit;
    const items = hasNext ? rows.slice(0, query.limit) : rows;
    const last = items.at(-1);
    return {
      items: items.map((row) => this.toItem(row)),
      nextCursor:
        hasNext && last ? encodeTimestampCursor({ timestamp: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async update(id: string, actorId: string, input: UpdateReportStatusDto): Promise<ReportQueueItem> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.postReport.findUnique({
        where: { id },
        include: { post: { select: { id: true, title: true, body: true } } },
      });
      if (!current) throw new NotFoundException('举报记录不存在');
      if (current.status === input.status) return current;
      if (current.status !== 'OPEN') throw new ConflictException('举报已处理，请刷新后重试');
      const result = await tx.postReport.updateMany({
        where: { id, status: 'OPEN' },
        data: {
          status: input.status,
          resolvedAt: new Date(),
          resolvedById: actorId,
          resolutionReason: input.reason.trim(),
        },
      });
      if (result.count !== 1) throw new ConflictException('举报已被其他管理员处理，请刷新后重试');
      await tx.notification.create({
        data: {
          userId: current.reporterId,
          type: 'MODERATION',
          title: '举报处理结果已更新',
          body:
            input.status === 'RESOLVED'
              ? '感谢你的反馈，我们已确认并处理该内容。'
              : '感谢你的反馈，经核查该举报暂不成立。',
          targetType: 'REPORT',
          targetId: current.id,
        },
      });
      return tx.postReport.findUniqueOrThrow({
        where: { id },
        include: { post: { select: { id: true, title: true, body: true } } },
      });
    });
    return this.toItem(updated);
  }

  private toItem(row: ReportRow): ReportQueueItem {
    return {
      id: row.id,
      postId: row.post.id,
      postTitle: row.post.title,
      postPreview: row.post.body.slice(0, 160),
      reporterId: row.reporterId,
      reason: row.reason,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      resolutionReason: row.resolutionReason,
    };
  }
}
