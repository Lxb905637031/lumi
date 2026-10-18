import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BodyProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.bodyProfile.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 50,
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
  }

  async create(userId: string, input: { name: string; heightCm?: number; weightKg?: number }) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.bodyProfile.create({ data: { userId, name: input.name } });
      return tx.bodyProfileVersion.create({
        data: {
          profileId: profile.id,
          version: 1,
          measurements: { heightCm: input.heightCm ?? null, weightKg: input.weightKg ?? null },
        },
        include: { profile: true },
      });
    });
  }

  async findOwned(userId: string, id: string) {
    const profile = await this.prisma.bodyProfile.findFirst({ where: { id, userId } });
    if (!profile) throw new NotFoundException('身材档案不存在');
    return profile;
  }
}
