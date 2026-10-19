import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import { validateEnvironment } from '../src/config/env';
import { sanitizeImage } from '../src/media/image-sanitizer';
import { ObjectCleanupService } from '../src/media/object-cleanup.service';
import { OBJECT_STORAGE } from '../src/media/object-storage.port';
import { PrismaService } from '../src/prisma/prisma.service';

test('image sanitization rotates, bounds dimensions and strips EXIF/ICC', async () => {
  const input = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#abc' } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  assert.ok((await sharp(input).metadata()).exif);
  const result = await sanitizeImage(input, 'image/jpeg');
  assert.equal(result.mimeType, 'image/webp');
  assert.equal(result.height, 2048);
  assert.ok(result.width < 700);
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
  assert.equal(metadata.orientation, undefined);
});

test('image decoding rejects MIME mismatch, corrupt payloads and oversized input', async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#abc' } })
    .png()
    .toBuffer();
  for (const [bytes, mime] of [
    [png, 'image/jpeg'],
    [png.subarray(0, 32), 'image/png'],
    [Buffer.from('89504e470d0a1a0a', 'hex'), 'image/png'],
    [Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png'],
  ] as const) {
    await assert.rejects(() => sanitizeImage(bytes, mime), BadRequestException);
  }
});

test('decompression pixel limit is enforced before accepting an image', async () => {
  const image = await sharp({ create: { width: 4001, height: 4001, channels: 3, background: '#abc' } })
    .png()
    .toBuffer();
  await assert.rejects(() => sanitizeImage(image, 'image/png'), BadRequestException);
});

test('S3 configuration fails closed and never echoes secrets from invalid values', () => {
  const base = {
    DATABASE_URL: 'postgresql://localhost/lumi',
    JWT_ACCESS_SECRET: 'secret-must-have-at-least-thirty-two-characters',
  };
  assert.throws(() => validateEnvironment({ ...base, MEDIA_STORAGE_DRIVER: 's3' }), /are required for s3/);
  const s3 = {
    ...base,
    FREE_MODE: 'false',
    WECHAT_APP_ID: 'wx-real',
    WECHAT_APP_SECRET: 'secret',
    CORS_ORIGINS: 'https://lumi.example',
    S3_ENDPOINT: 'http://localhost:59000',
    S3_BUCKET: 'lumi-media',
    S3_ACCESS_KEY: 'access-key',
    S3_SECRET_KEY: 'secret-key',
  };
  assert.throws(() => validateEnvironment({ ...s3, NODE_ENV: 'production' }), /Private S3/);
  assert.throws(
    () => validateEnvironment({ ...s3, NODE_ENV: 'production', MEDIA_STORAGE_DRIVER: 's3' }),
    /must use HTTPS/,
  );
  assert.equal(
    validateEnvironment({
      ...s3,
      NODE_ENV: 'production',
      MEDIA_STORAGE_DRIVER: 's3',
      S3_ENDPOINT: 'https://storage.example',
    }).MEDIA_STORAGE_DRIVER,
    's3',
  );
  assert.throws(
    () => validateEnvironment({ ...base, JWT_ACCESS_SECRET: 'never-echo-me' }),
    (error: unknown) => error instanceof Error && !error.message.includes('never-echo-me'),
  );
});

test('failed object deletion retains a durable retry without touching active objects', async () => {
  const tasks = [{ id: 'cleanup-fixture', objectKey: 'private/fixture', attempts: 0 }];
  const retries: Array<Record<string, unknown>> = [];
  let deletes = 0;
  let active = false;
  const moduleRef = await Test.createTestingModule({
    providers: [
      ObjectCleanupService,
      {
        provide: PrismaService,
        useValue: {
          mediaAsset: {
            updateMany: async () => ({ count: 0 }),
            findFirst: async () => (active ? { id: 'live-fixture' } : null),
          },
          objectCleanup: {
            findMany: async () => tasks,
            updateMany: async ({ data }: { data: Record<string, unknown> }) => {
              retries.push(data);
              return { count: 1 };
            },
            deleteMany: async () => {
              deletes += 1;
              return { count: 1 };
            },
          },
        },
      },
      { provide: ConfigService, useValue: { getOrThrow: () => 's3' } },
      {
        provide: OBJECT_STORAGE,
        useValue: {
          delete: async () => {
            throw new Error('offline');
          },
        },
      },
    ],
  }).compile();
  try {
    await moduleRef.get(ObjectCleanupService).sweep();
    assert.equal(deletes, 0);
    assert.equal(retries[0]?.lastErrorCode, 'STORAGE_DELETE_FAILED');
    assert.ok(retries[0]?.notBefore instanceof Date);
    active = true;
    await moduleRef.get(ObjectCleanupService).sweep();
    assert.equal(retries.length, 1, 'Active objects must never be passed to physical deletion');
  } finally {
    await moduleRef.close();
  }
});
