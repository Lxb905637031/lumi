import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { removeMediaAsset } from '../media/remove-media-asset';
import { GenerationsService } from './generations.service';

export type ResultAction = 'select' | 'save' | 'unsave' | 'delete';

@Injectable()
export class GenerationResultsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GenerationsService) private readonly generations: GenerationsService,
  ) {}

  async apply(userId: string, jobId: string, outputId: string, action: ResultAction) {
    await this.prisma.$transaction(async (tx) => {
      // One owner/job lock serializes candidate switching and all result state changes.
      await tx.$queryRaw`SELECT id FROM generation_jobs WHERE id = ${jobId} AND user_id = ${userId} FOR UPDATE`;
      const job = await tx.generationJob.findFirst({ where: { id: jobId, userId }, select: { status: true } });
      if (!job) throw new NotFoundException('生成结果不存在');
      const output = await tx.generationOutput.findFirst({
        where: { id: outputId, jobId, asset: { ownerId: userId } },
        include: { asset: { select: { status: true, deletedAt: true } } },
      });
      if (!output) throw new NotFoundException('生成结果不存在');
      if (action === 'delete' && output.deletedAt) return;
      if (output.deletedAt || output.asset.deletedAt || output.asset.status !== 'READY')
        throw new NotFoundException('生成结果已不可用');
      if (job.status !== 'SUCCEEDED') throw new ConflictException('只能操作已成功任务的结果');
      if (action === 'select') {
        if (output.selectedAt) return;
        await tx.generationOutput.updateMany({
          where: { jobId, selectedAt: { not: null } },
          data: { selectedAt: null },
        });
        await tx.generationOutput.update({ where: { id: outputId }, data: { selectedAt: new Date() } });
      } else if (action === 'save') {
        if (!output.selectedAt) throw new ConflictException('请先确认该结果再云端保存');
        if (!output.savedAt)
          await tx.generationOutput.update({ where: { id: outputId }, data: { savedAt: new Date() } });
      } else if (action === 'unsave') {
        await tx.generationOutput.update({ where: { id: outputId }, data: { savedAt: null } });
      } else {
        await tx.generationOutput.update({
          where: { id: outputId },
          data: { deletedAt: new Date(), selectedAt: null, savedAt: null },
        });
        await removeMediaAsset(tx, userId, output.assetId);
      }
    });
    return this.generations.findOwned(userId, jobId);
  }
}
