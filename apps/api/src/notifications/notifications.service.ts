import { Injectable, NotFoundException } from '@nestjs/common';
import type { CursorPage, Notification, NotificationDestination } from '@lumi/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { CursorPaginationDto } from '../common/pagination/pagination.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, pagination: CursorPaginationDto): Promise<CursorPage<Notification>> {
    const cursor = decodeTimestampCursor(pagination.cursor);
    const rows = await this.prisma.notification.findMany({
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
    });
    const hasNext = rows.length > pagination.limit;
    const items = hasNext ? rows.slice(0, pagination.limit) : rows;
    const last = items.at(-1);
    return {
      items: items.map((row) => this.toContract(row)),
      nextCursor:
        hasNext && last ? encodeTimestampCursor({ timestamp: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async unreadCount(userId: string) {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async destination(userId: string, id: string): Promise<NotificationDestination> {
    const item = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException('消息不存在');
    if (item.targetType === 'POST' && item.targetId) {
      const post = await this.prisma.post.findFirst({
        where: { id: item.targetId, deletedAt: null, moderationStatus: 'APPROVED' },
        select: { id: true },
      });
      if (!post) return { kind: 'UNAVAILABLE', message: '这篇穿搭已删除或尚未公开，可以继续查看其他消息。' };
      const comment = item.commentId
        ? await this.prisma.comment.findFirst({
            where: { id: item.commentId, postId: post.id, moderationStatus: 'APPROVED' },
            select: { id: true },
          })
        : null;
      return {
        kind: 'POST',
        id: post.id,
        commentId: comment?.id ?? null,
        notice: item.commentId && !comment ? '原评论已删除或暂不可见，仍可查看原帖。' : null,
      };
    }
    if (item.targetType === 'GENERATION_JOB' && item.targetId) {
      const job = await this.prisma.generationJob.findFirst({
        where: { id: item.targetId, userId },
        select: { id: true },
      });
      if (job) return { kind: 'GENERATION_JOB', id: job.id };
    }
    if (item.targetType === 'USER' && item.type === 'FOLLOW') return { kind: 'FOLLOWERS' };
    if (item.targetType === 'ANNOUNCEMENT' && item.targetId && item.type === 'SYSTEM') {
      const announcement = await this.prisma.announcement.findFirst({
        where: { id: item.targetId, status: { in: ['SENDING', 'SENT'] } },
        select: { title: true, body: true },
      });
      if (announcement) return { kind: 'ANNOUNCEMENT', ...announcement };
    }
    return {
      kind: 'UNAVAILABLE',
      message: item.targetType === 'REPORT' ? '举报处理结果已在这条消息中展示。' : '消息对应的内容暂不可查看。',
    };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { success: true };
  }

  async markRead(userId: string, id: string) {
    const item = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true, readAt: true },
    });
    if (!item) throw new NotFoundException('消息不存在');
    await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    return { success: true };
  }

  private toContract(row: {
    id: string;
    type: Notification['type'];
    title: string;
    body: string;
    targetType: string | null;
    targetId: string | null;
    commentId: string | null;
    readAt: Date | null;
    createdAt: Date;
  }): Notification {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      targetType: row.targetType,
      targetId: row.targetId,
      commentId: row.commentId,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
