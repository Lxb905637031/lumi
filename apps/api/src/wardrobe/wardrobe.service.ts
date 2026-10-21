import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { ClothingItem, CursorPage } from '@lumi/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { CursorPaginationDto } from '../common/pagination/pagination.dto';

@Injectable()
export class WardrobeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, pagination: CursorPaginationDto): Promise<CursorPage<ClothingItem>> {
    const cursor = decodeTimestampCursor(pagination.cursor);
    const items = await this.prisma.clothingItem.findMany({
      where: {
        userId,
        deletedAt: null,
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
      items: pageItems.map((item) => this.toContract(item)),
      nextCursor:
        hasNextPage && last
          ? encodeTimestampCursor({
              timestamp: last.updatedAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async create(
    userId: string,
    input: { name: string; category: string; assetId?: string; color?: string; style?: string },
  ): Promise<ClothingItem> {
    await this.assertAssetOwned(userId, input.assetId);
    const item = await this.prisma.clothingItem.create({
      data: {
        userId,
        name: input.name,
        category: input.category,
        assetId: input.assetId,
        color: input.color,
        style: input.style,
      },
    });
    return this.toContract(item);
  }

  async findOwned(userId: string, id: string): Promise<ClothingItem> {
    const item = await this.prisma.clothingItem.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('衣物资料不存在');
    return this.toContract(item);
  }

  async update(
    userId: string,
    id: string,
    input: { name: string; category: string; assetId?: string; color?: string; style?: string },
  ): Promise<ClothingItem> {
    await this.assertAssetOwned(userId, input.assetId);
    const result = await this.prisma.clothingItem.updateMany({
      where: { id, userId, deletedAt: null },
      data: {
        name: input.name,
        category: input.category,
        assetId: input.assetId,
        color: input.color,
        style: input.style,
      },
    });
    if (result.count !== 1) throw new NotFoundException('衣物资料不存在');
    return this.findOwned(userId, id);
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.clothingItem.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count !== 1) throw new NotFoundException('衣物资料不存在');
    return { success: true };
  }

  private async assertAssetOwned(userId: string, assetId?: string) {
    if (!assetId) return;
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, ownerId: userId, status: 'READY', deletedAt: null },
    });
    if (!asset) throw new NotFoundException('衣物图片不存在');
  }

  private toContract(row: Prisma.ClothingItemGetPayload<object>): ClothingItem {
    if (row.category !== 'TOP' && row.category !== 'BOTTOM' && row.category !== 'DRESS') {
      throw new InternalServerErrorException('衣物品类数据无效');
    }
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      category: row.category,
      color: row.color,
      style: row.style,
      assetId: row.assetId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
