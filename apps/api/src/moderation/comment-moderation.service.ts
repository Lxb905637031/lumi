import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { ModerationQueueQueryDto, UpdateModerationStatusDto } from './moderation.dto';

@Injectable()
export class CommentModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ModerationQueueQueryDto) {
    const cursor = decodeTimestampCursor(query.cursor);
    const rows = await this.prisma.comment.findMany({
      where: {
        ...(query.status ? { moderationStatus: query.status } : {}),
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
      select: { id: true, postId: true, authorId: true, body: true, moderationStatus: true, createdAt: true },
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

  async update(id: string, actorId: string, input: UpdateModerationStatusDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.comment.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('评论不存在');
      if (current.moderationStatus !== input.status) {
        const result = await tx.comment.updateMany({
          where: { id, moderationStatus: current.moderationStatus },
          data: { moderationStatus: input.status },
        });
        if (result.count !== 1) throw new ConflictException('评论状态已变化，请刷新');
        await tx.commentModerationAction.create({
          data: {
            commentId: id,
            actorId,
            fromStatus: current.moderationStatus,
            toStatus: input.status,
            reason: input.reason,
          },
        });
        await tx.notification.create({
          data: {
            userId: current.authorId,
            type: 'MODERATION',
            title: '评论审核状态已更新',
            body: input.reason ?? `评论状态：${input.status}`,
            targetType: 'POST',
            targetId: current.postId,
          },
        });
      }
      return { id, status: input.status };
    });
  }
}
