import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { AdminChallengeQueryDto, CreateChallengeDto } from './challenges.dto';
import type { CommunityChallenge, CursorPage } from '@lumi/contracts';

@Injectable()
export class ChallengesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const now = new Date();
    const rows = await this.prisma.challenge.findMany({
      where: { status: 'PUBLISHED', endsAt: { gt: now } },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { participants: { where: { leftAt: null } } } } },
    });
    return rows.map((row) => this.toContract(row));
  }

  async listAdmin(
    query: AdminChallengeQueryDto,
  ): Promise<CursorPage<CommunityChallenge & { pendingPostCount: number }>> {
    const cursor = decodeTimestampCursor(query.cursor);
    const rows = await this.prisma.challenge.findMany({
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
      include: {
        _count: {
          select: {
            participants: { where: { leftAt: null } },
            posts: { where: { deletedAt: null, moderationStatus: 'PENDING' } },
          },
        },
      },
    });
    const hasNextPage = rows.length > query.limit;
    const items = (hasNextPage ? rows.slice(0, query.limit) : rows).map((row) => this.toAdminContract(row));
    const last = rows.at(Math.min(rows.length, query.limit) - 1);
    return {
      items,
      nextCursor:
        hasNextPage && last ? encodeTimestampCursor({ timestamp: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async get(slug: string) {
    const challenge = await this.prisma.challenge.findFirst({
      where: { slug, status: { in: ['PUBLISHED', 'CLOSED'] } },
      include: { _count: { select: { participants: { where: { leftAt: null } } } } },
    });
    if (!challenge) throw new NotFoundException('挑战不存在');
    return this.toContract(challenge);
  }

  async myParticipation(userId: string, slug: string) {
    const challenge = await this.prisma.challenge.findFirst({
      where: { slug, status: { in: ['PUBLISHED', 'CLOSED'] } },
      select: { id: true },
    });
    if (!challenge) throw new NotFoundException('挑战不存在');
    const participant = await this.prisma.challengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId: challenge.id, userId } },
    });
    return {
      active: Boolean(participant && !participant.leftAt),
      joinedAt: participant?.joinedAt.toISOString() ?? null,
    };
  }

  async setParticipation(userId: string, slug: string, active: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM challenges WHERE slug = ${slug} FOR UPDATE
      `;
      if (!rows.length) throw new NotFoundException('挑战当前不可参与');
      const challenge = await tx.challenge.findUniqueOrThrow({ where: { id: rows[0]!.id } });
      if (challenge.status !== 'PUBLISHED') throw new NotFoundException('挑战当前不可参与');
      const now = new Date();
      if (active && (now < challenge.startsAt || now >= challenge.endsAt)) {
        throw new ConflictException('当前不在挑战参与时间内');
      }
      if (active) {
        const existing = await tx.challengeParticipant.findUnique({
          where: { challengeId_userId: { challengeId: challenge.id, userId } },
        });
        if (!existing) {
          await tx.challengeParticipant.create({ data: { challengeId: challenge.id, userId } });
        } else if (existing.leftAt) {
          await tx.challengeParticipant.update({
            where: { challengeId_userId: { challengeId: challenge.id, userId } },
            data: { leftAt: null, joinedAt: now },
          });
        }
      } else {
        const submitted = await tx.post.count({
          where: { authorId: userId, challengeId: challenge.id, deletedAt: null },
        });
        if (submitted) throw new ConflictException('已投稿挑战，不能退出参与记录');
        await tx.challengeParticipant.updateMany({
          where: { challengeId: challenge.id, userId, leftAt: null },
          data: { leftAt: now },
        });
      }
      const participant = await tx.challengeParticipant.findUnique({
        where: { challengeId_userId: { challengeId: challenge.id, userId } },
      });
      return {
        active: Boolean(participant && !participant.leftAt),
        joinedAt: participant?.joinedAt.toISOString() ?? null,
      };
    });
  }

  async create(actorId: string, input: CreateChallengeDto) {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (startsAt >= endsAt) throw new BadRequestException('挑战结束时间必须晚于开始时间');
    try {
      const created = await this.prisma.challenge.create({
        data: { ...input, startsAt, endsAt, createdById: actorId },
      });
      return this.toContract(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('挑战标识已存在');
      }
      throw error;
    }
  }

  async publish(id: string) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id } });
    if (!challenge) throw new NotFoundException('挑战不存在');
    if (challenge.status !== 'DRAFT') throw new ConflictException('只有草稿挑战可以发布');
    const changed = await this.prisma.challenge.updateMany({
      where: { id, status: 'DRAFT', updatedAt: challenge.updatedAt },
      data: { status: 'PUBLISHED' },
    });
    if (changed.count !== 1) throw new ConflictException('挑战状态已变化，请刷新后重试');
    return this.toContract(await this.prisma.challenge.findUniqueOrThrow({ where: { id } }));
  }

  async close(id: string) {
    const changed = await this.prisma.challenge.updateMany({
      where: { id, status: 'PUBLISHED' },
      data: { status: 'CLOSED' },
    });
    if (changed.count !== 1) throw new NotFoundException('可关闭的挑战不存在');
    return this.toContract(await this.prisma.challenge.findUniqueOrThrow({ where: { id } }));
  }

  private toContract(row: {
    id: string;
    slug: string;
    title: string;
    description: string;
    status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
    startsAt: Date;
    endsAt: Date;
    _count?: { participants: number };
  }) {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      status: row.status,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      participantCount: row._count?.participants ?? 0,
    };
  }

  private toAdminContract(row: {
    id: string;
    slug: string;
    title: string;
    description: string;
    status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
    startsAt: Date;
    endsAt: Date;
    _count: { participants: number; posts: number };
  }) {
    return { ...this.toContract(row), pendingPostCount: row._count.posts };
  }
}
