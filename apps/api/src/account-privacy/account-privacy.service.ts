import {
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type {
  AccountDeletionRequest as AccountDeletionEntity,
  DataExportRequest as DataExportEntity,
} from '@prisma/client';
import type { AccountDeletionRequest, CursorPage, DataExportRequest } from '@lumi/contracts';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { CursorPaginationDto } from '../common/pagination/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';

const EXPORT_CONFIRMATION = 'EXPORT_MY_DATA';

@Injectable()
export class AccountPrivacyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountPrivacyService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.processPendingExports(10).catch((error: unknown) => this.logger.error(error));
      void this.processDueDeletions(10).catch((error: unknown) => this.logger.error(error));
    }, 15_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async requestDeletion(userId: string): Promise<AccountDeletionRequest> {
    const graceDays = this.config.getOrThrow<number>('ACCOUNT_DELETION_GRACE_DAYS');
    const scheduledFor = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000);
    const request = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
      if (!user || user.status !== 'ACTIVE') throw new ConflictException('当前账号不可申请注销');
      const existing = await tx.accountDeletionRequest.findUnique({ where: { userId } });
      if (existing?.status === 'COMPLETED') throw new ConflictException('账号已经完成注销');
      if (existing?.status === 'REQUESTED' || existing?.status === 'PROCESSING') return existing;
      const next = existing
        ? await tx.accountDeletionRequest.update({
            where: { id: existing.id },
            data: {
              status: 'REQUESTED',
              requestedAt: new Date(),
              scheduledFor,
              startedAt: null,
              completedAt: null,
              cancelledAt: null,
              failureCode: null,
            },
          })
        : await tx.accountDeletionRequest.create({ data: { userId, scheduledFor } });
      await tx.accountDeletionEvent.create({
        data: {
          requestId: next.id,
          fromStatus: existing?.status ?? null,
          toStatus: 'REQUESTED',
          actorType: 'USER',
          actorId: userId,
          metadata: { scheduledFor: scheduledFor.toISOString() },
        },
      });
      return next;
    });
    return this.toDeletionContract(request);
  }

  async getDeletion(userId: string): Promise<AccountDeletionRequest | null> {
    const request = await this.prisma.accountDeletionRequest.findUnique({ where: { userId } });
    return request ? this.toDeletionContract(request) : null;
  }

  async cancelDeletion(userId: string): Promise<AccountDeletionRequest> {
    const request = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const current = await tx.accountDeletionRequest.findUnique({ where: { userId } });
      if (!current) throw new NotFoundException('没有待处理的注销申请');
      if (current.status === 'CANCELLED') return current;
      if (current.status !== 'REQUESTED') throw new ConflictException('注销已进入处理阶段，无法撤回');
      const updated = await tx.accountDeletionRequest.updateMany({
        where: { id: current.id, status: 'REQUESTED' },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      if (updated.count !== 1) throw new ConflictException('注销状态已变化，请刷新');
      await tx.accountDeletionEvent.create({
        data: {
          requestId: current.id,
          fromStatus: 'REQUESTED',
          toStatus: 'CANCELLED',
          actorType: 'USER',
          actorId: userId,
        },
      });
      return tx.accountDeletionRequest.findUniqueOrThrow({ where: { id: current.id } });
    });
    return this.toDeletionContract(request);
  }

  async createExport(userId: string, confirmation: string): Promise<DataExportRequest> {
    if (confirmation !== EXPORT_CONFIRMATION) throw new ConflictException('请确认导出账号数据');
    const request = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
      if (!user || user.status !== 'ACTIVE') throw new ConflictException('当前账号不可导出数据');
      const active = await tx.dataExportRequest.findFirst({
        where: { userId, status: { in: ['REQUESTED', 'PROCESSING'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (active) return active;
      return tx.dataExportRequest.create({ data: { userId } });
    });
    if (request.status === 'REQUESTED') {
      void this.processExport(request.id, userId).catch((error: unknown) => this.logger.error(error));
    }
    return this.toExportContract(request);
  }

  async listExports(userId: string, pagination: CursorPaginationDto): Promise<CursorPage<DataExportRequest>> {
    const cursor = decodeTimestampCursor(pagination.cursor);
    const rows = await this.prisma.dataExportRequest.findMany({
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
      take: pagination.limit + 1,
    });
    const hasNext = rows.length > pagination.limit;
    const items = hasNext ? rows.slice(0, pagination.limit) : rows;
    const last = items.at(-1);
    return {
      items: items.map((row) => this.toExportContract(row)),
      nextCursor:
        hasNext && last ? encodeTimestampCursor({ timestamp: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async getExport(userId: string, id: string): Promise<DataExportRequest> {
    const row = await this.getExportEntity(userId, id);
    await this.expireIfNeeded(row);
    return this.toExportContract(row.expiresAt && row.expiresAt <= new Date() ? { ...row, status: 'EXPIRED' } : row);
  }

  async downloadExport(userId: string, id: string) {
    const row = await this.getExportEntity(userId, id);
    if (row.status !== 'READY') throw new ConflictException('数据导出尚未准备好');
    if (!row.expiresAt || row.expiresAt <= new Date()) {
      await this.prisma.dataExportRequest.updateMany({
        where: { id, userId, status: 'READY' },
        data: { status: 'EXPIRED', payload: Prisma.JsonNull },
      });
      throw new GoneException('数据导出已过期，请重新申请');
    }
    return { id: row.id, exportedAt: row.readyAt?.toISOString() ?? null, data: row.payload };
  }

  async processPendingExports(limit: number) {
    const requests = await this.prisma.dataExportRequest.findMany({
      where: { status: 'REQUESTED' },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true, userId: true },
    });
    for (const request of requests) await this.processExport(request.id, request.userId);
    return { processed: requests.length };
  }

  async processDueDeletions(limit: number) {
    const requests = await this.prisma.accountDeletionRequest.findMany({
      where: { status: 'REQUESTED', scheduledFor: { lte: new Date() } },
      orderBy: { scheduledFor: 'asc' },
      take: limit,
      select: { id: true, userId: true },
    });
    let processed = 0;
    for (const request of requests) if (await this.processDeletion(request.id, request.userId)) processed += 1;
    return { processed };
  }

  private async processExport(id: string, userId: string) {
    const claimed = await this.prisma.dataExportRequest.updateMany({
      where: { id, userId, status: 'REQUESTED' },
      data: { status: 'PROCESSING', processingAt: new Date() },
    });
    if (claimed.count !== 1) return;
    try {
      const [user, profiles, clothingItems, mediaAssets, jobs, posts, comments, follows, notifications] =
        await Promise.all([
          this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { id: true, wxOpenId: true, status: true, createdAt: true },
          }),
          this.prisma.bodyProfile.findMany({ where: { userId }, include: { versions: true } }),
          this.prisma.clothingItem.findMany({ where: { userId } }),
          this.prisma.mediaAsset.findMany({
            where: { ownerId: userId },
            select: { id: true, mimeType: true, byteSize: true, status: true, visibility: true, createdAt: true },
          }),
          this.prisma.generationJob.findMany({
            where: { userId },
            include: {
              outputs: { select: { id: true, assetId: true, selectedAt: true, savedAt: true, deletedAt: true } },
            },
          }),
          this.prisma.post.findMany({ where: { authorId: userId } }),
          this.prisma.comment.findMany({ where: { authorId: userId } }),
          this.prisma.follow.findMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }),
          this.prisma.notification.findMany({ where: { userId } }),
        ]);
      const ttlHours = this.config.getOrThrow<number>('DATA_EXPORT_TTL_HOURS');
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
      const payload = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        user: { ...user, createdAt: user.createdAt.toISOString() },
        profiles: profiles.map((profile) => ({
          ...profile,
          createdAt: profile.createdAt.toISOString(),
          updatedAt: profile.updatedAt.toISOString(),
          versions: profile.versions.map((version) => ({ ...version, createdAt: version.createdAt.toISOString() })),
        })),
        clothingItems: clothingItems.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
        mediaAssets: mediaAssets.map((asset) => ({ ...asset, createdAt: asset.createdAt.toISOString() })),
        generationJobs: jobs.map((job) => ({
          ...job,
          createdAt: job.createdAt.toISOString(),
          updatedAt: job.updatedAt.toISOString(),
          startedAt: job.startedAt?.toISOString() ?? null,
          completedAt: job.completedAt?.toISOString() ?? null,
          outputs: job.outputs.map((output) => ({
            ...output,
            selectedAt: output.selectedAt?.toISOString() ?? null,
            savedAt: output.savedAt?.toISOString() ?? null,
            deletedAt: output.deletedAt?.toISOString() ?? null,
          })),
        })),
        posts: posts.map((post) => ({
          ...post,
          createdAt: post.createdAt.toISOString(),
          updatedAt: post.updatedAt.toISOString(),
        })),
        comments: comments.map((comment) => ({ ...comment, createdAt: comment.createdAt.toISOString() })),
        follows: follows.map((follow) => ({ ...follow, createdAt: follow.createdAt.toISOString() })),
        notifications: notifications.map((notification) => ({
          ...notification,
          createdAt: notification.createdAt.toISOString(),
          readAt: notification.readAt?.toISOString() ?? null,
        })),
      } satisfies Prisma.InputJsonValue;
      await this.prisma.dataExportRequest.updateMany({
        where: { id, userId, status: 'PROCESSING' },
        data: { status: 'READY', readyAt: new Date(), expiresAt, payload },
      });
    } catch (error) {
      this.logger.error(`data export ${id} failed`, error instanceof Error ? error.stack : String(error));
      await this.prisma.dataExportRequest.updateMany({
        where: { id, userId, status: 'PROCESSING' },
        data: { status: 'FAILED', failureCode: 'EXPORT_FAILED' },
      });
    }
  }

  private async processDeletion(id: string, userId: string) {
    const claimed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.accountDeletionRequest.updateMany({
        where: { id, userId, status: 'REQUESTED', scheduledFor: { lte: new Date() } },
        data: { status: 'PROCESSING', startedAt: new Date(), failureCode: null },
      });
      if (updated.count !== 1) return false;
      await tx.accountDeletionEvent.create({
        data: { requestId: id, fromStatus: 'REQUESTED', toStatus: 'PROCESSING', actorType: 'SYSTEM' },
      });
      return true;
    });
    if (!claimed) return false;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
        if (!user) throw new Error('USER_NOT_FOUND');
        const assets = await tx.mediaAsset.findMany({
          where: { ownerId: userId },
          select: { objectKey: true, stagingObjectKey: true },
        });
        for (const asset of assets) {
          for (const objectKey of [asset.objectKey, asset.stagingObjectKey]) {
            if (objectKey)
              await tx.objectCleanup.upsert({
                where: { objectKey },
                create: { objectKey, notBefore: new Date() },
                update: { notBefore: new Date() },
              });
          }
        }
        await tx.user.update({ where: { id: userId }, data: { status: 'DELETED', wxOpenId: `deleted:${userId}` } });
        await tx.dataExportRequest.updateMany({
          where: { userId },
          data: { status: 'EXPIRED', payload: Prisma.JsonNull },
        });
        await tx.comment.deleteMany({ where: { authorId: userId } });
        await tx.postReport.deleteMany({ where: { reporterId: userId } });
        await tx.postLike.deleteMany({ where: { userId } });
        await tx.postBookmark.deleteMany({ where: { userId } });
        await tx.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } });
        await tx.post.deleteMany({ where: { authorId: userId } });
        await tx.moderationAction.deleteMany({ where: { actorId: userId } });
        await tx.commentModerationAction.deleteMany({ where: { actorId: userId } });
        await tx.notification.deleteMany({ where: { userId } });
        await tx.generationOutput.deleteMany({ where: { job: { userId } } });
        await tx.generationJob.deleteMany({ where: { userId } });
        await tx.bodyProfile.deleteMany({ where: { userId } });
        await tx.clothingItem.deleteMany({ where: { userId } });
        await tx.mediaAsset.deleteMany({ where: { ownerId: userId } });
        await tx.quotaReservation.deleteMany({ where: { userId } });
        await tx.quotaLedger.deleteMany({ where: { userId } });
        await tx.quotaAccount.deleteMany({ where: { userId } });
        await tx.adminCredential.deleteMany({ where: { userId } });
        await tx.userSession.deleteMany({ where: { userId } });
        await tx.accountDeletionRequest.update({
          where: { id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
        await tx.accountDeletionEvent.create({
          data: { requestId: id, fromStatus: 'PROCESSING', toStatus: 'COMPLETED', actorType: 'SYSTEM' },
        });
      });
      return true;
    } catch (error) {
      this.logger.error(`account deletion ${id} failed`, error instanceof Error ? error.stack : String(error));
      await this.prisma.$transaction(async (tx) => {
        await tx.accountDeletionRequest.updateMany({
          where: { id, userId, status: 'PROCESSING' },
          data: { status: 'FAILED', failureCode: 'PURGE_FAILED', scheduledFor: new Date(Date.now() + 60_000) },
        });
        await tx.accountDeletionEvent.create({
          data: {
            requestId: id,
            fromStatus: 'PROCESSING',
            toStatus: 'FAILED',
            actorType: 'SYSTEM',
            metadata: { code: 'PURGE_FAILED' },
          },
        });
      });
      return false;
    }
  }

  private async getExportEntity(userId: string, id: string): Promise<DataExportEntity> {
    const row = await this.prisma.dataExportRequest.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('数据导出不存在');
    return row;
  }

  private async expireIfNeeded(row: DataExportEntity) {
    if (row.status === 'READY' && row.expiresAt && row.expiresAt <= new Date()) {
      await this.prisma.dataExportRequest.updateMany({
        where: { id: row.id, status: 'READY' },
        data: { status: 'EXPIRED', payload: Prisma.JsonNull },
      });
    }
  }

  private toDeletionContract(row: AccountDeletionEntity): AccountDeletionRequest {
    return {
      id: row.id,
      status: row.status,
      requestedAt: row.requestedAt.toISOString(),
      scheduledFor: row.scheduledFor.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      failureCode: row.failureCode,
    };
  }

  private toExportContract(row: DataExportEntity): DataExportRequest {
    return {
      id: row.id,
      status: row.status,
      requestedAt: row.requestedAt.toISOString(),
      processingAt: row.processingAt?.toISOString() ?? null,
      readyAt: row.readyAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      failureCode: row.failureCode,
    };
  }
}

export { EXPORT_CONFIRMATION };
