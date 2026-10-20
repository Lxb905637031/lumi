import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import type { AdminUser, CursorPage } from '@lumi/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { UserModerationQueryDto, UpdateUserModerationDto } from './user-moderation.dto';

type UserRow = Prisma.UserGetPayload<{
  include: { _count: { select: { posts: true; reports: true } } };
}>;

@Injectable()
export class UserModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: UserModerationQueryDto): Promise<CursorPage<AdminUser>> {
    const cursor = decodeTimestampCursor(query.cursor);
    const search = query.search?.trim();
    const rows = await this.prisma.user.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.role ? { role: query.role } : {}),
        ...(search ? { id: { contains: search } } : {}),
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
      include: { _count: { select: { posts: true, reports: true } } },
    });
    const hasNext = rows.length > query.limit;
    const items = hasNext ? rows.slice(0, query.limit) : rows;
    const last = items.at(-1);
    return {
      items: items.map((row) => this.toContract(row)),
      nextCursor:
        hasNext && last ? encodeTimestampCursor({ timestamp: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async update(id: string, actorId: string, input: UpdateUserModerationDto): Promise<AdminUser> {
    if (id === actorId) throw new ForbiddenException('不能修改当前登录管理员账号');
    const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
    if (Number.isNaN(expectedUpdatedAt.valueOf())) throw new ConflictException('版本时间无效，请刷新后重试');
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
      const current = await tx.user.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('用户不存在');
      if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        throw new ConflictException('用户状态已变化，请刷新后重试');
      }
      if (current.status === UserStatus.DELETED) throw new ConflictException('已注销账号不可恢复或改权');
      const nextStatus = input.status ?? current.status;
      const nextRole = input.role ?? current.role;
      if (nextStatus === current.status && nextRole === current.role) {
        return tx.user.findUniqueOrThrow({
          where: { id },
          include: { _count: { select: { posts: true, reports: true } } },
        });
      }
      if (nextRole === UserRole.ADMIN && current.role !== UserRole.ADMIN) {
        const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true } });
        if (actor?.role !== UserRole.ADMIN) throw new ForbiddenException('只有管理员可以授予管理员角色');
      }
      if (nextStatus === UserStatus.SUSPENDED) await tx.userSession.deleteMany({ where: { userId: id } });
      const result = await tx.user.updateMany({
        where: { id, updatedAt: current.updatedAt },
        data: {
          status: nextStatus,
          role: nextRole,
        },
      });
      if (result.count !== 1) throw new ConflictException('用户状态已变化，请刷新后重试');
      await tx.userModerationAction.create({
        data: {
          userId: id,
          actorId,
          fromStatus: current.status,
          toStatus: nextStatus,
          fromRole: current.role,
          toRole: nextRole,
          reason: input.reason.trim(),
        },
      });
      return tx.user.findUniqueOrThrow({
        where: { id },
        include: { _count: { select: { posts: true, reports: true } } },
      });
    });
    return this.toContract(updated);
  }

  async actions(id: string, query: UserModerationQueryDto) {
    const cursor = decodeTimestampCursor(query.cursor);
    const rows = await this.prisma.userModerationAction.findMany({
      where: {
        userId: id,
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
      select: {
        id: true,
        actorId: true,
        fromStatus: true,
        toStatus: true,
        fromRole: true,
        toRole: true,
        reason: true,
        createdAt: true,
      },
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

  private toContract(row: UserRow): AdminUser {
    return {
      id: row.id,
      status: row.status,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      postCount: row._count.posts,
      reportCount: row._count.reports,
    };
  }
}
