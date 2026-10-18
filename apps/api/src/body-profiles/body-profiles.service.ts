import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CursorPage } from '@lumi/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { CursorPaginationDto } from '../common/pagination/pagination.dto';

type BodyProfileListItem = Prisma.BodyProfileGetPayload<{
  include: { versions: { take: 1 } };
}>;

@Injectable()
export class BodyProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, pagination: CursorPaginationDto): Promise<CursorPage<BodyProfileListItem>> {
    const cursor = decodeTimestampCursor(pagination.cursor);
    const profiles = await this.prisma.bodyProfile.findMany({
      where: {
        userId,
        ...(cursor
          ? {
              OR: [
                { updatedAt: { lt: new Date(cursor.timestamp) } },
                {
                  updatedAt: new Date(cursor.timestamp),
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: pagination.limit + 1,
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    const hasNextPage = profiles.length > pagination.limit;
    const items = hasNextPage ? profiles.slice(0, pagination.limit) : profiles;
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasNextPage && last
          ? encodeTimestampCursor({
              timestamp: last.updatedAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async create(userId: string, input: { name: string; heightCm?: number; weightKg?: number }) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.bodyProfile.create({
        data: { userId, name: input.name },
      });
      return tx.bodyProfileVersion.create({
        data: {
          profileId: profile.id,
          version: 1,
          measurements: {
            heightCm: input.heightCm ?? null,
            weightKg: input.weightKg ?? null,
          },
        },
        include: { profile: true },
      });
    });
  }

  async findOwned(userId: string, id: string) {
    const profile = await this.prisma.bodyProfile.findFirst({
      where: { id, userId },
    });
    if (!profile) throw new NotFoundException('身材档案不存在');
    return profile;
  }
}
