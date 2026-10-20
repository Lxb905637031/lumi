import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Announcement, CursorPage } from '@lumi/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type {
  AnnouncementQueryDto,
  CreateAnnouncementDto,
  PublishAnnouncementDto,
  UpdateAnnouncementDto,
} from './announcements.dto';

const DELIVERY_BATCH_SIZE = 250;

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, input: CreateAnnouncementDto): Promise<Announcement> {
    const existing = await this.prisma.announcement.findFirst({
      where: { authorId, idempotencyKey: input.idempotencyKey },
      include: { _count: { select: { recipients: true } } },
    });
    if (existing) return this.toContract(existing);
    try {
      const row = await this.prisma.announcement.create({
        data: { authorId, idempotencyKey: input.idempotencyKey, title: input.title.trim(), body: input.body.trim() },
        include: { _count: { select: { recipients: true } } },
      });
      return this.toContract(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const row = await this.prisma.announcement.findFirstOrThrow({
          where: { authorId, idempotencyKey: input.idempotencyKey },
          include: { _count: { select: { recipients: true } } },
        });
        return this.toContract(row);
      }
      throw error;
    }
  }

  async list(query: AnnouncementQueryDto): Promise<CursorPage<Announcement>> {
    const cursor = decodeTimestampCursor(query.cursor);
    const rows = await this.prisma.announcement.findMany({
      where: cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.timestamp) } },
              { createdAt: new Date(cursor.timestamp), id: { lt: cursor.id } },
            ],
          }
        : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: {
        _count: { select: { recipients: true } },
      },
    });
    const hasNext = rows.length > query.limit;
    const items = hasNext ? rows.slice(0, query.limit) : rows;
    const last = items.at(-1);
    return {
      items: await Promise.all(items.map((row) => this.toContract(row))),
      nextCursor:
        hasNext && last ? encodeTimestampCursor({ timestamp: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async get(id: string): Promise<Announcement> {
    const row = await this.prisma.announcement.findUnique({
      where: { id },
      include: {
        _count: { select: { recipients: true } },
      },
    });
    if (!row) throw new NotFoundException('公告不存在');
    return this.toContract(row);
  }

  async update(id: string, input: UpdateAnnouncementDto): Promise<Announcement> {
    const changed = await this.prisma.announcement.updateMany({
      where: { id, status: 'DRAFT', version: input.expectedVersion },
      data: { title: input.title.trim(), body: input.body.trim(), version: { increment: 1 } },
    });
    if (changed.count !== 1) {
      const current = await this.prisma.announcement.findUnique({ where: { id }, select: { id: true } });
      if (!current) throw new NotFoundException('公告不存在');
      throw new ConflictException('公告已发布或版本已变化，请刷新后重试');
    }
    return this.get(id);
  }

  async publish(id: string, input: PublishAnnouncementDto): Promise<Announcement> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM announcements WHERE id = ${id} FOR UPDATE`;
      const current = await tx.announcement.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('公告不存在');
      if (current.status === 'DRAFT') {
        if (current.version !== input.expectedVersion) throw new ConflictException('公告版本已变化，请刷新后重试');
        await tx.announcement.update({
          where: { id },
          data: { status: 'SENDING', publishedAt: new Date(), version: { increment: 1 } },
        });
        const recipients = await tx.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
        await tx.announcement.update({ where: { id }, data: { recipientCount: recipients.length } });
        for (let offset = 0; offset < recipients.length; offset += DELIVERY_BATCH_SIZE) {
          await tx.announcementRecipient.createMany({
            data: recipients.slice(offset, offset + DELIVERY_BATCH_SIZE).map(({ id: userId }) => ({
              announcementId: id,
              userId,
            })),
            skipDuplicates: true,
          });
        }
      } else if (current.status === 'SENDING') {
        if (current.version !== input.expectedVersion) {
          throw new ConflictException('公告版本已变化，请刷新后重试');
        }
      } else {
        if (current.version === input.expectedVersion) return;
        throw new ConflictException('公告已发布');
      }
    });

    const announcement = await this.prisma.announcement.findUniqueOrThrow({ where: { id } });
    while (true) {
      const pending = await this.prisma.announcementRecipient.findMany({
        where: { announcementId: id, deliveredAt: null },
        orderBy: { userId: 'asc' },
        take: DELIVERY_BATCH_SIZE,
        select: { userId: true },
      });
      if (!pending.length) break;
      const userIds = pending.map(({ userId }) => userId);
      await this.prisma.$transaction([
        this.prisma.notification.createMany({
          data: userIds.map((userId) => ({
            userId,
            type: 'SYSTEM' as const,
            title: announcement.title,
            body: announcement.body,
            targetType: 'ANNOUNCEMENT',
            targetId: id,
            eventKey: `announcement:${id}:${userId}`,
          })),
          skipDuplicates: true,
        }),
        this.prisma.announcementRecipient.updateMany({
          where: { announcementId: id, userId: { in: userIds }, deliveredAt: null },
          data: { deliveredAt: new Date() },
        }),
      ]);
    }
    await this.prisma.announcement.updateMany({
      where: { id, status: 'SENDING' },
      data: { status: 'SENT', sentAt: new Date() },
    });
    return this.get(id);
  }

  private async toContract(row: {
    id: string;
    title: string;
    body: string;
    status: 'DRAFT' | 'SENDING' | 'SENT';
    version: number;
    createdAt: Date;
    publishedAt: Date | null;
    sentAt: Date | null;
    recipientCount: number | null;
    _count: { recipients: number };
  }): Promise<Announcement> {
    const [recipientCount, deliveredCount] = await Promise.all([
      row.recipientCount ?? row._count.recipients,
      this.prisma.announcementRecipient.count({ where: { announcementId: row.id, deliveredAt: { not: null } } }),
    ]);
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      status: row.status,
      version: row.version,
      recipientCount,
      deliveredCount,
      createdAt: row.createdAt.toISOString(),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
    };
  }
}
