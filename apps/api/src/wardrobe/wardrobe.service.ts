import { Injectable, NotFoundException } from '@nestjs/common';
import type { ClothingItem as ClothingItemEntity } from '@prisma/client';
import type { CursorPage } from '@lumi/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { CursorPaginationDto } from '../common/pagination/pagination.dto';

@Injectable()
export class WardrobeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, pagination: CursorPaginationDto): Promise<CursorPage<ClothingItemEntity>> {
    const cursor = decodeTimestampCursor(pagination.cursor);
    const items = await this.prisma.clothingItem.findMany({
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
    });
    const hasNextPage = items.length > pagination.limit;
    const pageItems = hasNextPage ? items.slice(0, pagination.limit) : items;
    const last = pageItems.at(-1);
    return {
      items: pageItems,
      nextCursor:
        hasNextPage && last
          ? encodeTimestampCursor({
              timestamp: last.updatedAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  create(userId: string, input: { name: string; category: string; assetId?: string }) {
    return this.prisma.clothingItem.create({
      data: {
        userId,
        name: input.name,
        category: input.category,
        assetId: input.assetId,
      },
    });
  }

  async findOwned(userId: string, id: string) {
    const item = await this.prisma.clothingItem.findFirst({
      where: { id, userId },
    });
    if (!item) throw new NotFoundException('衣物资料不存在');
    return item;
  }
}
