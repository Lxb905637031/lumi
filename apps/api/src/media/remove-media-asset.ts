import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/** Caller must use a transaction. Post creation uses the same media row lock. */
export async function removeMediaAsset(tx: Prisma.TransactionClient, userId: string, id: string) {
  await tx.$queryRaw`SELECT id FROM media_assets WHERE id = ${id} AND owner_id = ${userId} FOR UPDATE`;
  const asset = await tx.mediaAsset.findFirst({ where: { id, ownerId: userId } });
  if (!asset) throw new NotFoundException('图片不存在');
  if (asset.deletedAt) return;
  const post = await tx.post.findFirst({
    where: { deletedAt: null, imageAssetIds: { array_contains: [id] } },
    select: { id: true },
  });
  if (post) throw new ConflictException('图片已被帖子引用，请先删除相关帖子');
  const result = await tx.generationOutput.findFirst({ where: { assetId: id, deletedAt: null }, select: { id: true } });
  if (result) throw new ConflictException('图片属于生成结果，请从生成记录删除结果');
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
}
