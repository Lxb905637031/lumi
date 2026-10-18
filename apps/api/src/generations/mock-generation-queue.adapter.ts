import { Injectable, Logger } from '@nestjs/common';
import { GenerationJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { EnqueueGenerationCommand, GenerationQueue } from './generation-queue.port';

@Injectable()
export class MockGenerationQueueAdapter implements GenerationQueue {
  private readonly logger = new Logger(MockGenerationQueueAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async enqueue({ jobId, userId }: EnqueueGenerationCommand): Promise<void> {
    setTimeout(() => {
      void this.process(jobId, userId).catch((error: unknown) => {
        this.logger.error(`Mock generation failed for job ${jobId}`, error instanceof Error ? error.stack : undefined);
      });
    }, 0);
  }

  private async process(jobId: string, userId: string): Promise<void> {
    await this.delay(350);
    const started = await this.prisma.generationJob.updateMany({
      where: { id: jobId, userId, status: GenerationJobStatus.QUEUED },
      data: { status: GenerationJobStatus.RUNNING },
    });
    if (started.count === 0) return;

    await this.delay(650);
    const job = await this.prisma.generationJob.findFirst({
      where: { id: jobId, userId },
    });
    if (!job || job.status !== GenerationJobStatus.RUNNING) return;

    const asset = await this.prisma.mediaAsset.create({
      data: {
        ownerId: userId,
        objectKey: `mock/generations/${jobId}.jpg`,
        mimeType: 'image/jpeg',
        byteSize: 0,
        sha256: `mock-${jobId}`,
      },
    });
    await this.prisma.$transaction([
      this.prisma.generationOutput.create({
        data: { jobId, assetId: asset.id },
      }),
      this.prisma.generationJob.update({
        where: { id: jobId },
        data: { status: GenerationJobStatus.SUCCEEDED },
      }),
    ]);
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
