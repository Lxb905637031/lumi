import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage.port';
import { PROCESSING_LEASE_MS } from './media.service';

@Injectable()
export class ObjectCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ObjectCleanupService.name);
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  onModuleInit() {
    if (this.config.getOrThrow<string>('MEDIA_STORAGE_DRIVER') !== 's3') return;
    this.timer = setInterval(() => this.schedule(), 30_000);
    this.timer.unref();
    this.schedule();
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.active;
  }

  private schedule() {
    if (this.active) return;
    this.active = this.sweep()
      .catch(() => this.logger.error('Object cleanup sweep failed; retry scheduled'))
      .finally(() => {
        this.active = undefined;
      });
  }

  async sweep() {
    const stale = new Date(Date.now() - PROCESSING_LEASE_MS);
    await this.prisma.mediaAsset.updateMany({
      where: {
        uploadExpiresAt: { lt: new Date() },
        deletedAt: null,
        OR: [{ status: 'PENDING' }, { status: 'PROCESSING', processingStartedAt: { lt: stale } }],
      },
      data: { status: 'EXPIRED', processingToken: null, processingStartedAt: null },
    });
    const tasks = await this.prisma.objectCleanup.findMany({
      where: { notBefore: { lte: new Date() } },
      orderBy: { notBefore: 'asc' },
      take: 50,
    });
    for (const task of tasks) {
      try {
        const active = await this.prisma.mediaAsset.findFirst({
          where: {
            deletedAt: null,
            OR: [
              { objectKey: task.objectKey, status: 'READY' },
              { stagingObjectKey: task.objectKey, status: 'PROCESSING', processingStartedAt: { gte: stale } },
            ],
          },
          select: { id: true },
        });
        if (active) continue;
        await this.storage.delete(task.objectKey);
        await this.prisma.objectCleanup.deleteMany({ where: { id: task.id } });
      } catch {
        await this.prisma.objectCleanup.updateMany({
          where: { id: task.id },
          data: {
            attempts: { increment: 1 },
            lastErrorCode: 'STORAGE_DELETE_FAILED',
            notBefore: new Date(Date.now() + Math.min(3_600_000, 30_000 * 2 ** Math.min(task.attempts, 7))),
          },
        });
        this.logger.warn(`Object cleanup ${task.id} failed; durable retry retained`);
      }
    }
  }
}
