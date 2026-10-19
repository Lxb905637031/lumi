import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
        archivedAt: null,
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

  async create(
    userId: string,
    input: {
      name: string;
      heightCm?: number;
      weightKg?: number;
      shoulderCm?: number;
      bustCm?: number;
      waistCm?: number;
      hipCm?: number;
      sourceAssetId?: string;
    },
  ) {
    await this.assertAssetOwned(userId, input.sourceAssetId);
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
            shoulderCm: input.shoulderCm ?? null,
            bustCm: input.bustCm ?? null,
            waistCm: input.waistCm ?? null,
            hipCm: input.hipCm ?? null,
          },
          sourceAssetId: input.sourceAssetId,
        },
        include: { profile: true },
      });
    });
  }

  async findOwned(userId: string, id: string) {
    const profile = await this.prisma.bodyProfile.findFirst({
      where: { id, userId, archivedAt: null },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!profile) throw new NotFoundException('身材档案不存在');
    return profile;
  }

  async update(
    userId: string,
    id: string,
    input: Parameters<BodyProfilesService['create']>[1] & { expectedVersion: number },
  ) {
    await this.assertAssetOwned(userId, input.sourceAssetId);
    const profile = await this.prisma.bodyProfile.findFirst({ where: { id, userId, archivedAt: null } });
    if (!profile) throw new NotFoundException('身材档案不存在');
    if (profile.activeVersion !== input.expectedVersion)
      throw new ConflictException('档案已有新版本，请刷新后确认参数');
    return this.prisma.$transaction(async (tx) => {
      const version = profile.activeVersion + 1;
      const updated = await tx.bodyProfile.updateMany({
        where: { id, userId, archivedAt: null, activeVersion: input.expectedVersion },
        data: { name: input.name, activeVersion: version },
      });
      if (updated.count !== 1) throw new ConflictException('档案状态已变化，请刷新');
      return tx.bodyProfileVersion.create({
        data: {
          profileId: id,
          version,
          measurements: {
            heightCm: input.heightCm ?? null,
            weightKg: input.weightKg ?? null,
            shoulderCm: input.shoulderCm ?? null,
            bustCm: input.bustCm ?? null,
            waistCm: input.waistCm ?? null,
            hipCm: input.hipCm ?? null,
          },
          sourceAssetId:
            input.sourceAssetId ??
            (
              await tx.bodyProfileVersion.findUnique({
                where: { profileId_version: { profileId: id, version: profile.activeVersion } },
                select: { sourceAssetId: true },
              })
            )?.sourceAssetId,
        },
        include: { profile: true },
      });
    });
  }

  async archive(userId: string, id: string) {
    const updated = await this.prisma.bodyProfile.updateMany({
      where: { id, userId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (updated.count !== 1) throw new NotFoundException('身材档案不存在');
    return { success: true };
  }

  private async assertAssetOwned(userId: string, assetId?: string) {
    if (!assetId) return;
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, ownerId: userId, status: 'READY', deletedAt: null },
    });
    if (!asset) throw new NotFoundException('人物图片不存在');
  }
}
