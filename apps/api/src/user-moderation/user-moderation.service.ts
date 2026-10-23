import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import type { AdminUser, CursorPage } from '@lumi/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { MuteUserDto, UserModerationQueryDto, UpdateUserModerationDto } from './user-moderation.dto';

type UserRow = Prisma.UserGetPayload<{
  include: {
    _count: { select: { posts: true; reports: true } };
    mutes: true;
  };
}>;

@Injectable()
export class UserModerationService {
  constructor(private readonly prisma: PrismaService) {}

  private activeMuteWhere(now = new Date()) {
    return {
      revokedAt: null,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    };
  }

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
      include: {
        _count: { select: { posts: true, reports: true } },
        mutes: { where: this.activeMuteWhere(), orderBy: { createdAt: 'desc' }, take: 1 },
      },
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
          include: {
            _count: { select: { posts: true, reports: true } },
            mutes: { where: this.activeMuteWhere(), take: 1 },
          },
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
        include: {
          _count: { select: { posts: true, reports: true } },
          mutes: { where: this.activeMuteWhere(), take: 1 },
        },
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
      items: items.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        fromRole: row.fromRole,
        toRole: row.toRole,
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor:
        hasNext && last ? encodeTimestampCursor({ timestamp: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async mutes(userId: string, query: UserModerationQueryDto) {
    const cursor = decodeTimestampCursor(query.cursor);
    const rows = await this.prisma.userMute.findMany({
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
      take: query.limit + 1,
      select: {
        id: true,
        actorId: true,
        reason: true,
        startsAt: true,
        endsAt: true,
        revokedAt: true,
        revokedById: true,
        createdAt: true,
      },
    });
    const hasNext = rows.length > query.limit;
    const items = (hasNext ? rows.slice(0, query.limit) : rows).map((row) => ({
      id: row.id,
      actorId: row.actorId,
      reason: row.reason,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      revokedById: row.revokedById,
      createdAt: row.createdAt.toISOString(),
    }));
    const last = rows[items.length - 1];
    return {
      items,
      nextCursor:
        hasNext && last ? encodeTimestampCursor({ timestamp: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async mute(id: string, actorId: string, input: MuteUserDto) {
    if (id === actorId) throw new ForbiddenException('不能禁言当前登录管理员账号');
    const now = new Date();
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (endsAt && endsAt <= now) throw new BadRequestException('禁言结束时间必须晚于当前时间');
    const expected = new Date(input.expectedUpdatedAt);
    if (Number.isNaN(expected.valueOf())) throw new ConflictException('版本时间无效，请刷新后重试');
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException('用户不存在');
      if (user.updatedAt.getTime() !== expected.getTime()) throw new ConflictException('用户状态已变化，请刷新后重试');
      if (user.status !== UserStatus.ACTIVE) throw new ConflictException('仅正常状态用户可以禁言');
      const active = await tx.userMute.findFirst({
        where: { userId: id, revokedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      });
      if (active) throw new ConflictException('用户已处于禁言状态');
      const version = new Date(Math.max(now.getTime(), user.updatedAt.getTime() + 1));
      const versioned = await tx.user.updateMany({
        where: { id, updatedAt: user.updatedAt },
        data: { updatedAt: version },
      });
      if (versioned.count !== 1) throw new ConflictException('用户状态已变化，请刷新后重试');
      await tx.userMute.create({ data: { userId: id, actorId, reason: input.reason.trim(), endsAt } });
      return tx.user.findUniqueOrThrow({
        where: { id },
        include: {
          _count: { select: { posts: true, reports: true } },
          mutes: {
            where: this.activeMuteWhere(now),
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
    });
    return this.toContract(row);
  }

  async unmute(id: string, actorId: string, input: MuteUserDto) {
    if (id === actorId) throw new ForbiddenException('不能操作当前登录管理员账号');
    const expected = new Date(input.expectedUpdatedAt);
    if (Number.isNaN(expected.valueOf())) throw new ConflictException('版本时间无效，请刷新后重试');
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException('用户不存在');
      if (user.updatedAt.getTime() !== expected.getTime()) throw new ConflictException('用户状态已变化，请刷新后重试');
      const now = new Date();
      const active = await tx.userMute.findFirst({
        where: { userId: id, revokedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      });
      if (!active) throw new ConflictException('用户当前没有有效禁言');
      const version = new Date(Math.max(now.getTime(), user.updatedAt.getTime() + 1));
      const versioned = await tx.user.updateMany({
        where: { id, updatedAt: user.updatedAt },
        data: { updatedAt: version },
      });
      if (versioned.count !== 1) throw new ConflictException('用户状态已变化，请刷新后重试');
      await tx.userMute.update({ where: { id: active.id }, data: { revokedAt: now, revokedById: actorId } });
      return tx.user.findUniqueOrThrow({
        where: { id },
        include: {
          _count: { select: { posts: true, reports: true } },
          mutes: {
            where: this.activeMuteWhere(now),
            take: 1,
          },
        },
      });
    });
    return this.toContract(row);
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
      activeMute: row.mutes[0]
        ? {
            id: row.mutes[0].id,
            reason: row.mutes[0].reason,
            startsAt: row.mutes[0].startsAt.toISOString(),
            endsAt: row.mutes[0].endsAt?.toISOString() ?? null,
            createdAt: row.mutes[0].createdAt.toISOString(),
          }
        : null,
    };
  }
}
