import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WardrobeService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.clothingItem.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
  }

  create(userId: string, input: { name: string; category: string; assetId?: string }) {
    return this.prisma.clothingItem.create({
      data: { userId, name: input.name, category: input.category, assetId: input.assetId },
    });
  }

  async findOwned(userId: string, id: string) {
    const item = await this.prisma.clothingItem.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException('衣物资料不存在');
    return item;
  }
}
