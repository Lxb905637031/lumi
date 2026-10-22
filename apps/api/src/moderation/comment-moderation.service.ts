import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { ModerationQueueQueryDto, UpdateModerationStatusDto } from './moderation.dto';
import { notifyInteraction } from '../notifications/interaction-notification';

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
      items: items.map((row) => ({
        id: row.id,
        postId: row.postId,
        authorId: row.authorId,
        body: row.body,
        moderationStatus: row.moderationStatus,
        createdAt: row.createdAt.toISOString(),
      })),
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
        if (input.status === 'APPROVED') {
          const post = await tx.post.findFirst({
            where: { id: current.postId, moderationStatus: 'APPROVED', deletedAt: null },
            select: { authorId: true },
          });
          if (post)
            await notifyInteraction(tx, {
              actorId: current.authorId,
              recipientId: post.authorId,
              postId: current.postId,
              commentId: id,
            });
        }
      }
      return { id, status: input.status };
    });
  }

  async actions(id: string, query: ModerationQueueQueryDto) {
    const comment = await this.prisma.comment.findUnique({ where: { id }, select: { id: true } });
    if (!comment) throw new NotFoundException('评论不存在');
    const cursor = decodeTimestampCursor(query.cursor);
    const rows = await this.prisma.commentModerationAction.findMany({
      where: {
        commentId: id,
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
}
