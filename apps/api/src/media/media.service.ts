import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MediaAsset as MediaAssetEntity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_IMAGE_BYTES, sanitizeImage } from './image-sanitizer';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage.port';
import type { ReserveMediaUploadDto } from './media.dto';

const UPLOAD_TTL_SECONDS = 300;
export const PROCESSING_LEASE_MS = 120_000;
const READ_TTL_SECONDS = 60;

@Injectable()
export class MediaService {
  private processingCount = 0;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async createLocalAsset(userId: string, input: { fileName: string; mimeType: string; base64: string }) {
    if (
      this.config.getOrThrow<string>('FREE_MODE') !== 'true' ||
      this.config.getOrThrow<string>('MEDIA_STORAGE_DRIVER') !== 'local'
    ) {
      throw new ServiceUnavailableException('开发媒体接口未启用，请使用签名上传');
    }
    const image = await this.sanitizeBounded(Buffer.from(input.base64, 'base64'), input.mimeType);
    const asset = await this.prisma.mediaAsset.create({
      data: {
        ownerId: userId,
        objectKey: `local/${userId}/${randomUUID()}.webp`,
        mimeType: image.mimeType,
        byteSize: image.bytes.length,
        width: image.width,
        height: image.height,
        sha256: createHash('sha256').update(image.bytes).digest('hex'),
        visibility: 'PRIVATE',
        previewData: `data:image/webp;base64,${image.bytes.toString('base64')}`,
      },
    });
    return this.toContract(asset);
  }

  async reserveUpload(userId: string, input: ReserveMediaUploadDto) {
    if (this.config.getOrThrow<string>('MEDIA_STORAGE_DRIVER') !== 's3')
      throw new ServiceUnavailableException('私有对象存储未启用');
    const existing = await this.prisma.mediaAsset.findUnique({
      where: { ownerId_uploadRequestKey: { ownerId: userId, uploadRequestKey: input.idempotencyKey } },
    });
    if (existing) return this.uploadContract(existing, input);
    const expiresAt = new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000);
    const stagingKey = `staging/${userId}/${randomUUID()}`;
    let asset: MediaAssetEntity;
    try {
      asset = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const duplicate = await tx.mediaAsset.findUnique({
          where: { ownerId_uploadRequestKey: { ownerId: userId, uploadRequestKey: input.idempotencyKey } },
        });
        if (duplicate) return duplicate;
        const pending = await tx.mediaAsset.count({
          where: { ownerId: userId, deletedAt: null, status: { in: ['PENDING', 'PROCESSING'] } },
        });
        if (pending >= 20) throw new ConflictException('未完成的上传过多，请先完成或删除');
        const row = await tx.mediaAsset.create({
          data: {
            ownerId: userId,
            objectKey: `reserved/${randomUUID()}`,
            storageDriver: 's3',
            status: 'PENDING',
            stagingObjectKey: stagingKey,
            uploadRequestKey: input.idempotencyKey,
            uploadMimeType: input.mimeType,
            uploadByteSize: input.byteSize,
            uploadExpiresAt: expiresAt,
            mimeType: input.mimeType,
            byteSize: input.byteSize,
            sha256: '',
          },
        });
        await tx.objectCleanup.create({
          data: { objectKey: stagingKey, notBefore: new Date(expiresAt.getTime() + 60_000) },
        });
        return row;
      });
    } catch (error) {
      if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'P2002') throw error;
      const winner = await this.prisma.mediaAsset.findUnique({
        where: { ownerId_uploadRequestKey: { ownerId: userId, uploadRequestKey: input.idempotencyKey } },
      });
      if (!winner) throw error;
      asset = winner;
    }
    return this.uploadContract(asset, input);
  }

  private async uploadContract(asset: MediaAssetEntity, input: ReserveMediaUploadDto) {
    if (asset.deletedAt || ['EXPIRED', 'REJECTED', 'DELETED'].includes(asset.status))
      throw new ConflictException('该上传请求已失效，请重新选择图片');
    if (asset.uploadMimeType !== input.mimeType || asset.uploadByteSize !== input.byteSize)
      throw new ConflictException('相同上传标识不能用于不同文件');
    if (asset.status === 'READY') return { assetId: asset.id, status: asset.status, expiresAt: null, upload: null };
    const remaining = Math.floor(((asset.uploadExpiresAt?.getTime() ?? 0) - Date.now()) / 1000);
    if (remaining < 1 || !asset.stagingObjectKey) throw new ConflictException('上传凭证已过期');
    try {
      const upload = await this.storage.createUpload(asset.stagingObjectKey, asset.mimeType, asset.byteSize, remaining);
      return { assetId: asset.id, status: asset.status, expiresAt: asset.uploadExpiresAt!.toISOString(), upload };
    } catch {
      throw new ServiceUnavailableException('无法签发上传凭证，请稍后重试');
    }
  }

  async completeUpload(userId: string, id: string) {
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id, ownerId: userId, deletedAt: null } });
    if (!asset) throw new NotFoundException('图片不存在');
    if (asset.status === 'READY') return this.toContract(asset);
    if (
      asset.storageDriver !== 's3' ||
      !asset.stagingObjectKey ||
      !asset.uploadExpiresAt ||
      asset.uploadExpiresAt.getTime() <= Date.now()
    )
      throw new ConflictException('上传已失效');
    const token = randomUUID();
    const claimed = await this.prisma.mediaAsset.updateMany({
      where: {
        id,
        deletedAt: null,
        OR: [
          { status: 'PENDING' },
          { status: 'PROCESSING', processingStartedAt: { lt: new Date(Date.now() - PROCESSING_LEASE_MS) } },
        ],
      },
      data: { status: 'PROCESSING', processingToken: token, processingStartedAt: new Date() },
    });
    if (claimed.count !== 1) throw new ConflictException('图片正在处理或已失效，请刷新后重试');
    try {
      const uploaded = await this.storage.read(asset.stagingObjectKey, MAX_IMAGE_BYTES);
      if (uploaded.bytes.length !== asset.byteSize || uploaded.mimeType !== asset.mimeType)
        throw new BadRequestException('上传内容与预留文件不符');
      const image = await this.sanitizeBounded(uploaded.bytes, asset.mimeType);
      const objectKey = `private/${userId}/${id}/${token}.webp`;
      // Register durable orphan protection before the external write.
      await this.prisma.objectCleanup.create({ data: { objectKey, notBefore: new Date(Date.now() + 15 * 60_000) } });
      await this.storage.put(objectKey, image.bytes, image.mimeType);
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.mediaAsset.updateMany({
          where: {
            id,
            status: 'PROCESSING',
            processingToken: token,
            processingStartedAt: { gte: new Date(Date.now() - PROCESSING_LEASE_MS) },
            deletedAt: null,
          },
          data: {
            status: 'READY',
            objectKey,
            mimeType: image.mimeType,
            byteSize: image.bytes.length,
            sha256: createHash('sha256').update(image.bytes).digest('hex'),
            width: image.width,
            height: image.height,
            processingToken: null,
            processingStartedAt: null,
          },
        });
        if (updated.count !== 1) throw new ConflictException('图片状态已变化，请刷新');
        await tx.objectCleanup.deleteMany({ where: { objectKey } });
      });
      return this.findOwned(userId, id);
    } catch (error) {
      await this.prisma.mediaAsset.updateMany({
        where: { id, status: 'PROCESSING', processingToken: token, deletedAt: null },
        data: {
          status: error instanceof BadRequestException ? 'REJECTED' : 'PENDING',
          processingToken: null,
          processingStartedAt: null,
        },
      });
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      throw new ServiceUnavailableException('图片存储暂不可用，请保留文件并重试完成上传');
    }
  }

  async findOwned(userId: string, id: string) {
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id, ownerId: userId, deletedAt: null } });
    if (!asset) throw new NotFoundException('图片不存在');
    return this.toContract(asset);
  }

  async removeOwned(userId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      // Serialize deletion with the final READY transition so a concurrently finalized object cannot lose its cleanup task.
      await tx.$queryRaw`SELECT id FROM media_assets WHERE id = ${id} AND owner_id = ${userId} FOR UPDATE`;
      const asset = await tx.mediaAsset.findFirst({ where: { id, ownerId: userId } });
      if (!asset) throw new NotFoundException('图片不存在');
      if (asset.deletedAt) return;
      await tx.mediaAsset.update({
        where: { id },
        data: { status: 'DELETED', deletedAt: new Date(), visibility: 'DELETED', previewData: null },
      });
      if (asset.storageDriver === 's3' && asset.status === 'READY') {
        await tx.objectCleanup.upsert({
          where: { objectKey: asset.objectKey },
          create: { objectKey: asset.objectKey, notBefore: new Date() },
          update: { notBefore: new Date() },
        });
      }
    });
    return { success: true };
  }

  // Posts must already be authorized for this viewer. A PUBLIC asset flag alone is never authorization.
  async previewsForPosts(
    posts: Array<{ id: string; authorId: string; moderationStatus: string; imageAssetIds: unknown }>,
    viewerId?: string,
  ) {
    const idsByPost = new Map(
      posts
        .filter((post) => post.moderationStatus === 'APPROVED' || post.authorId === viewerId)
        .map((post) => [
          post.id,
          {
            authorId: post.authorId,
            ids: Array.isArray(post.imageAssetIds)
              ? post.imageAssetIds.filter((id): id is string => typeof id === 'string')
              : [],
          },
        ]),
    );
    const ids = [...new Set([...idsByPost.values()].flatMap((post) => post.ids))];
    if (!ids.length) return new Map<string, string[]>();
    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: ids }, status: 'READY', deletedAt: null },
    });
    const urls = new Map(
      await Promise.all(
        assets.map(
          async (asset) => [asset.id, { ownerId: asset.ownerId, url: await this.readLocation(asset) }] as const,
        ),
      ),
    );
    return new Map(
      [...idsByPost].map(([postId, post]) => [
        postId,
        post.ids.flatMap((id) => {
          const asset = urls.get(id);
          return asset?.url && asset.ownerId === post.authorId ? [asset.url] : [];
        }),
      ]),
    );
  }

  private async sanitizeBounded(bytes: Buffer, mimeType: string) {
    if (this.processingCount >= 2) throw new ServiceUnavailableException('图片处理繁忙，请稍后重试');
    this.processingCount += 1;
    try {
      return await sanitizeImage(bytes, mimeType);
    } finally {
      this.processingCount -= 1;
    }
  }

  private async readLocation(asset: MediaAssetEntity) {
    if (asset.deletedAt || asset.status !== 'READY') return null;
    if (asset.storageDriver === 'local') return asset.previewData;
    try {
      return await this.storage.signedRead(asset.objectKey, READ_TTL_SECONDS);
    } catch {
      throw new ServiceUnavailableException('图片读取暂不可用');
    }
  }

  private async toContract(asset: MediaAssetEntity) {
    const url = await this.readLocation(asset);
    return {
      id: asset.id,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      status: asset.status,
      storageDriver: asset.storageDriver,
      visibility: asset.visibility,
      width: asset.width,
      height: asset.height,
      previewData: asset.storageDriver === 'local' && asset.status === 'READY' ? asset.previewData : null,
      url: asset.storageDriver === 's3' ? url : null,
      urlExpiresAt:
        asset.storageDriver === 's3' && url ? new Date(Date.now() + READ_TTL_SECONDS * 1000).toISOString() : null,
      createdAt: asset.createdAt.toISOString(),
    };
  }
}
