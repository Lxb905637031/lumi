import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { GenerationSharingService } from '../src/generations/generation-sharing.service';

function outputFixture() {
  return {
    id: 'output-1',
    assetId: 'asset-1',
    createdAt: new Date('2026-10-24T00:00:00.000Z'),
    selectedAt: new Date('2026-10-24T00:01:00.000Z'),
    deletedAt: null,
    asset: { id: 'asset-1', status: 'READY', deletedAt: null, mimeType: 'image/png' },
    job: { provider: 'local-svg', status: 'SUCCEEDED' },
  };
}

function createHarness(readUrl: string | null = 'https://cdn.example/result.png') {
  const output = outputFixture();
  let currentReadUrl = readUrl;
  let createdData: Record<string, unknown> | undefined;
  let share:
    { id: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null; output: typeof output } | undefined;
  const prisma = {
    generationOutput: {
      findFirst: async () => output,
    },
    generationShare: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdData = data;
        share = {
          id: 'share-1',
          tokenHash: String(data.tokenHash),
          expiresAt: data.expiresAt as Date,
          revokedAt: null,
          output,
        };
        return share;
      },
      findUnique: async () => share,
      updateMany: async () => {
        if (!share) return { count: 0 };
        share.revokedAt = new Date();
        return { count: 1 };
      },
    },
  };
  const media = { readForShare: async () => currentReadUrl };
  return {
    service: new GenerationSharingService(prisma as never, media as never),
    getCreated: () => createdData,
    getShare: () => share,
    setReadUrl: (url: string | null) => {
      currentReadUrl = url;
    },
  };
}

test('share creation checks media availability before persisting and only stores a token hash', async () => {
  const unavailable = createHarness(null);
  await assert.rejects(() => unavailable.service.create('user-1', 'job-1', 'output-1'), ConflictException);
  assert.equal(unavailable.getCreated(), undefined);

  const harness = createHarness();
  const result = await harness.service.create('user-1', 'job-1', 'output-1');
  const data = harness.getCreated();
  assert.ok(data);
  assert.equal(result.id, 'share-1');
  assert.match(result.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(data.tokenHash, createHash('sha256').update(result.token).digest('hex'));
  assert.notEqual(data.tokenHash, result.token);
  assert.equal(result.developmentPreview, true);
});

test('share read rejects malformed, expired and revoked credentials', async () => {
  const harness = createHarness();
  const created = await harness.service.create('user-1', 'job-1', 'output-1');
  await assert.rejects(() => harness.service.read('too-short'), NotFoundException);
  const share = harness.getShare();
  assert.ok(share);
  share.expiresAt = new Date(Date.now() - 1);
  await assert.rejects(() => harness.service.read(created.token), NotFoundException);

  const active = createHarness();
  const activeResult = await active.service.create('user-1', 'job-1', 'output-1');
  await active.service.revoke('user-1', 'share-1');
  await assert.rejects(() => active.service.read(activeResult.token), NotFoundException);
});

test('share read refuses a valid database credential when the image URL is unavailable', async () => {
  const harness = createHarness();
  const created = await harness.service.create('user-1', 'job-1', 'output-1');
  harness.setReadUrl(null);
  await assert.rejects(() => harness.service.read(created.token), ConflictException);
});
