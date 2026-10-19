import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GenerationJobStatus } from '@prisma/client';
import type { Job } from 'bullmq';
import { PrismaService } from '../src/prisma/prisma.service';
import { GenerationProcessor } from '../src/generations/generation.processor';
import {
  GENERATION_PROVIDER,
  type GenerateImageCommand,
  type GenerationProvider,
} from '../src/generations/generation-provider.port';
import type { EnqueueGenerationCommand } from '../src/generations/generation-queue.port';
import { LocalGenerationProvider } from '../src/generations/local-generation-provider';
import { QuotaService } from '../src/quota/quota.service';

test('local generation provider returns a deterministic private preview asset', async () => {
  const provider = new LocalGenerationProvider();
  const command: GenerateImageCommand = {
    jobId: 'job-local-1',
    userId: 'user-1',
    profileVersionId: 'profile-version-1',
    clothingAssetId: 'clothing-1',
  };
  const first = await provider.generate(command);
  const second = await provider.generate(command);

  assert.equal(first.objectKey, 'local/generations/job-local-1.svg');
  assert.equal(first.mimeType, 'image/svg+xml');
  assert.equal(first.previewData, second.previewData);
  assert.match(first.previewData ?? '', /^data:image\/svg\+xml;base64,/);
  assert.ok(first.byteSize > 0);
  assert.equal(first.sha256.length, 64);
});

test('generation processor moves a permanently failing job to dead letter', async () => {
  const updates: Array<Record<string, unknown>> = [];
  const prismaMock = {
    generationJob: {
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ id: 'job-failing-1', userId: 'user-1', quotaAttempt: 1, retryCount: 3 }),
    },
    generationOutput: {
      findFirst: async () => null,
    },
    notification: { create: async () => ({}) },
  };
  Object.assign(prismaMock, {
    $transaction: async (action: (tx: typeof prismaMock) => Promise<unknown>) => action(prismaMock),
  });
  let refunds = 0;
  const provider: GenerationProvider = {
    generate: async () => {
      throw new Error('provider unavailable');
    },
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      GenerationProcessor,
      { provide: PrismaService, useValue: prismaMock },
      { provide: GENERATION_PROVIDER, useValue: provider },
      { provide: ConfigService, useValue: { getOrThrow: (key: string) => (key === 'FREE_MODE' ? 'true' : 3) } },
      {
        provide: QuotaService,
        useValue: {
          release: async () => {
            refunds += 1;
          },
        },
      },
    ],
  }).compile();
  const processor = moduleRef.get(GenerationProcessor);
  const command: EnqueueGenerationCommand = {
    jobId: 'job-failing-1',
    userId: 'user-1',
    profileVersionId: 'profile-version-1',
    clothingAssetId: 'clothing-1',
  };
  const job = { data: command, attemptsMade: 2, opts: { attempts: 3 } } as unknown as Job<EnqueueGenerationCommand>;

  await assert.rejects(() => processor.process(job), /provider unavailable/);
  assert.equal(updates[0]?.status, GenerationJobStatus.RUNNING);
  assert.equal(updates.at(-1)?.status, GenerationJobStatus.DEAD_LETTER);
  assert.equal(updates.at(-1)?.errorCode, 'Error');
  assert.equal(refunds, 1);
});
