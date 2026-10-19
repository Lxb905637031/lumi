import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CommunityUser, CursorPage } from '@lumi/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { CursorPaginationDto } from '../common/pagination/pagination.dto';

@Injectable()
export class FollowService {
  constructor(private readonly prisma: PrismaService) {}

  async set(userId: string, targetId: string, active: boolean) {
    if (userId === targetId) throw new ConflictException('不能关注自己');
    const result = await this.prisma.$transaction(async (tx) => {
      const first = userId < targetId ? userId : targetId;
      const second = userId < targetId ? targetId : userId;
      await tx.$queryRaw`SELECT id FROM users WHERE id IN (${first}, ${second}) ORDER BY id FOR NO KEY UPDATE`;
      const target = await tx.user.findFirst({ where: { id: targetId, status: 'ACTIVE' }, select: { id: true } });
      if (!target) throw new NotFoundException('用户不存在');
      const existing = await tx.follow.findUnique({
        where: { followerId_followingId: { followerId: userId, followingId: targetId } },
      });
      if (!active) {
        if (existing) await tx.follow.delete({ where: { id: existing.id } });
        return false;
      }
      if (existing) return true;
      await tx.follow.create({ data: { followerId: userId, followingId: targetId } });
      await tx.notification.create({
        data: {
          userId: targetId,
          type: 'FOLLOW',
          title: '新的关注',
          body: '有人开始关注你了',
          targetType: 'USER',
          targetId: userId,
        },
      });
      return true;
    });
    return { following: result };
  }

  async state(userId: string, targetId: string) {
    if (userId === targetId) return { following: false };
    const row = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId, followingId: targetId } },
      select: { id: true },
    });
    return { following: Boolean(row) };
  }

  async list(
    userId: string,
    direction: 'followers' | 'following',
    pagination: CursorPaginationDto,
  ): Promise<CursorPage<CommunityUser>> {
    const cursor = decodeTimestampCursor(pagination.cursor);
    const rows = await this.prisma.follow.findMany({
      where: {
        ...(direction === 'followers' ? { followingId: userId } : { followerId: userId }),
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
      include: {
        follower: { select: { id: true } },
        following: { select: { id: true } },
      },
    });
    const hasNext = rows.length > pagination.limit;
    const items = hasNext ? rows.slice(0, pagination.limit) : rows;
    const last = items.at(-1);
    const target = (row: (typeof rows)[number]) => (direction === 'followers' ? row.follower : row.following);
    const targetIds = items.map((row) => target(row).id);
    const followedIds =
      direction === 'following'
        ? new Set(targetIds)
        : new Set(
            (
              await this.prisma.follow.findMany({
                where: { followerId: userId, followingId: { in: targetIds } },
                select: { followingId: true },
              })
            ).map((row) => row.followingId),
          );
    return {
      items: items.map((row) => ({
        id: target(row).id,
        displayName: `Lumi 用户 ${target(row).id.slice(-6)}`,
        followed: followedIds.has(target(row).id),
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor:
        hasNext && last ? encodeTimestampCursor({ timestamp: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }
}
