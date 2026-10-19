import { Injectable, NotFoundException } from '@nestjs/common';
import type { CursorPage, Notification } from '@lumi/contracts';
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
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
