import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { BodyProfile, BodyProfileVersion, CursorPage, CreateBodyProfileResponse } from '@lumi/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { CursorPaginationDto } from '../common/pagination/pagination.dto';
import { decodeProfileVersionCursor, encodeProfileVersionCursor } from './profile-version-cursor';

type BodyProfileRecord = Prisma.BodyProfileGetPayload<{ include: { versions: true } }>;
type ProfileVersionRecord = Prisma.BodyProfileVersionGetPayload<object>;

@Injectable()
export class BodyProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, pagination: CursorPaginationDto): Promise<CursorPage<BodyProfile>> {
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
      items: items.map((profile) => this.toProfile(profile)),
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
  ): Promise<CreateBodyProfileResponse> {
    await this.assertAssetOwned(userId, input.sourceAssetId);
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.bodyProfile.create({
        data: { userId, name: input.name },
      });
      const version = await tx.bodyProfileVersion.create({
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
      return this.toCreateResponse(version);
    });
  }

  async findOwned(userId: string, id: string): Promise<BodyProfile> {
    const profile = await this.prisma.bodyProfile.findFirst({
      where: { id, userId, archivedAt: null },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!profile) throw new NotFoundException('身材档案不存在');
    return this.toProfile(profile);
  }

  async listVersions(
    userId: string,
    id: string,
    pagination: CursorPaginationDto,
  ): Promise<CursorPage<BodyProfileVersion>> {
    const profile = await this.prisma.bodyProfile.findFirst({
      where: { id, userId, archivedAt: null },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('身材档案不存在');

    const cursor = decodeProfileVersionCursor(pagination.cursor);
    const versions = await this.prisma.bodyProfileVersion.findMany({
      where: {
        profileId: id,
        ...(cursor ? { version: { lt: cursor } } : {}),
      },
      orderBy: { version: 'desc' },
      take: pagination.limit + 1,
    });
    const hasNextPage = versions.length > pagination.limit;
    const items = hasNextPage ? versions.slice(0, pagination.limit) : versions;
    const last = items.at(-1);
    return {
      items: items.map((version) => this.toVersion(version)),
      nextCursor: hasNextPage && last ? encodeProfileVersionCursor(last.version) : null,
    };
  }

  async update(
    userId: string,
    id: string,
    input: Parameters<BodyProfilesService['create']>[1] & { expectedVersion: number },
  ): Promise<CreateBodyProfileResponse> {
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
      const created = await tx.bodyProfileVersion.create({
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
      return this.toCreateResponse(created);
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

  private toCreateResponse(
    row: ProfileVersionRecord & { profile: Omit<BodyProfileRecord, 'versions'> },
  ): CreateBodyProfileResponse {
    const version = this.toVersion(row);
    return {
      ...version,
      profile: this.toProfile({ ...row.profile, versions: [row] }),
    };
  }

  private toProfile(row: BodyProfileRecord): BodyProfile {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      activeVersion: row.activeVersion,
      versions: row.versions.map((version) => this.toVersion(version)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toVersion(row: ProfileVersionRecord): BodyProfileVersion {
    const values =
      row.measurements && typeof row.measurements === 'object' && !Array.isArray(row.measurements)
        ? row.measurements
        : {};
    const measurement = (key: string) => {
      const value = values[key];
      return typeof value === 'number' ? value : null;
    };
    return {
      id: row.id,
      profileId: row.profileId,
      sourceAssetId: row.sourceAssetId,
      version: row.version,
      measurements: {
        heightCm: measurement('heightCm'),
        weightKg: measurement('weightKg'),
        shoulderCm: measurement('shoulderCm'),
        bustCm: measurement('bustCm'),
        waistCm: measurement('waistCm'),
        hipCm: measurement('hipCm'),
      },
      createdAt: row.createdAt.toISOString(),
    };
  }
}
