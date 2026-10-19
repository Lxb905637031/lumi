import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MediaAsset as MediaAssetEntity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createLocalAsset(userId: string, input: { fileName: string; mimeType: string; base64: string }) {
    if (this.config.getOrThrow<string>('FREE_MODE') !== 'true') {
      throw new ServiceUnavailableException('媒体存储尚未配置');
    }
    const bytes = Buffer.from(input.base64, 'base64');
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException('图片大小必须在 1B 至 5MB 之间');
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.mimeType)) {
      throw new BadRequestException('仅支持 JPG、PNG 或 WebP 图片');
    }
    const validSignature =
      (input.mimeType === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) ||
      (input.mimeType === 'image/jpeg' && bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) ||
      (input.mimeType === 'image/webp' &&
        bytes.subarray(0, 4).toString() === 'RIFF' &&
        bytes.subarray(8, 12).toString() === 'WEBP');
    if (!validSignature) throw new BadRequestException('图片内容与声明格式不匹配');
    const extension = input.mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
    const objectKey = `local/${userId}/${randomUUID()}.${extension}`;
    const asset = await this.prisma.mediaAsset.create({
      data: {
        ownerId: userId,
        objectKey,
        mimeType: input.mimeType,
        byteSize: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        visibility: 'PRIVATE',
        previewData: `data:${input.mimeType};base64,${input.base64}`,
      },
    });
    return this.toContract(asset);
  }

  async findOwned(userId: string, id: string) {
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id, ownerId: userId, deletedAt: null } });
    if (!asset) throw new NotFoundException('图片不存在');
    return this.toContract(asset);
  }

  async removeOwned(userId: string, id: string) {
    const result = await this.prisma.mediaAsset.updateMany({
      where: { id, ownerId: userId, deletedAt: null },
      data: { deletedAt: new Date(), visibility: 'DELETED', previewData: null },
    });
    if (result.count !== 1) throw new NotFoundException('图片不存在');
    return { success: true };
  }

  private toContract(asset: MediaAssetEntity) {
    return {
      id: asset.id,
      objectKey: asset.objectKey,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      visibility: asset.visibility,
      previewData: asset.previewData,
      createdAt: asset.createdAt.toISOString(),
    };
  }
}
