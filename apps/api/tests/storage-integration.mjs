import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { databaseTarget } from '../scripts/migration-tools.mjs';
import { normalizeEnvelope } from './api-envelope.mjs';

const baseUrl = process.env.LUMI_API_URL ?? 'http://127.0.0.1:4301/api/v1';
const loopback = ['127.0.0.1', 'localhost', '[::1]'];
assert.ok(loopback.includes(new URL(baseUrl).hostname), 'Storage integration is local-only');
databaseTarget(process.env.DATABASE_URL);
const endpoint = new URL(process.env.S3_ENDPOINT ?? 'http://127.0.0.1:59000');
assert.ok(loopback.includes(endpoint.hostname), 'Storage fixtures must not target a remote bucket');
const bucket = process.env.S3_BUCKET ?? 'lumi-media';
const storage = new S3Client({
  endpoint: endpoint.origin,
  region: process.env.S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'lumi',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'lumi-local-secret',
  },
  requestHandler: { connectionTimeout: 5_000, requestTimeout: 10_000 },
  maxAttempts: 1,
});
const prisma = new PrismaClient();
const users = [];
const runId = randomUUID();
const passed = [];
let requests = 0;

async function request(path, status = 200, init = {}) {
  requests += 1;
  const response = await fetch(baseUrl + path, {
    ...init,
    signal: AbortSignal.timeout(20_000),
    headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
  });
  const data = await response.json();
  assert.equal(response.status, status, `${path}: ${JSON.stringify(data)}`);
  return normalizeEnvelope(data);
}

const json = (method, headers, body) => ({ method, headers, body: JSON.stringify(body) });

async function login(label) {
  const session = await request(
    '/auth/wechat/login',
    201,
    json('POST', {}, { code: `local:storage-${runId}-${label}` }),
  );
  users.push(session.user.id);
  return { userId: session.user.id, headers: { authorization: `Bearer ${session.accessToken}` } };
}

async function upload(reservation, bytes, mutate = (fields) => fields, statuses = [201]) {
  const fields = mutate({ ...reservation.upload.fields });
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append('file', new Blob([bytes], { type: fields['Content-Type'] }), 'fixture.png');
  const response = await fetch(reservation.upload.url, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  assert.ok(statuses.includes(response.status), `S3 signed POST ${response.status}: ${await response.text()}`);
}

async function missing(key) {
  try {
    await storage.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return false;
  } catch (error) {
    if (error.$metadata?.httpStatusCode === 404) return true;
    throw error;
  }
}

try {
  const bootstrap = await request('/system/bootstrap');
  assert.equal(bootstrap.freeMode, true, 'Never run fixtures on a production API');
  assert.equal(bootstrap.media.uploadMode, 'signed-post');
  const owner = await login('owner');
  const outsider = await login('outsider');
  const imageBytes = await sharp({ create: { width: 64, height: 96, channels: 3, background: '#98a' } })
    .png()
    .withMetadata()
    .toBuffer();
  const input = { fileName: 'fixture.png', mimeType: 'image/png', byteSize: imageBytes.length, idempotencyKey: runId };
  await request('/media/assets/uploads', 401, json('POST', {}, input));
  await request('/media/assets/uploads', 400, json('POST', owner.headers, { ...input, byteSize: 5 * 1024 * 1024 + 1 }));
  await request('/media/assets/uploads', 400, json('POST', owner.headers, { ...input, objectKey: 'attacker-chosen' }));
  const reservation = await request('/media/assets/uploads', 201, json('POST', owner.headers, input));
  assert.equal(
    (await request('/media/assets/uploads', 201, json('POST', owner.headers, input))).assetId,
    reservation.assetId,
  );
  await request('/media/assets/uploads', 409, json('POST', owner.headers, { ...input, byteSize: input.byteSize + 1 }));
  await request('/media/assets/' + reservation.assetId, 404, { headers: outsider.headers });
  await request('/media/assets/' + reservation.assetId + '/complete', 404, {
    method: 'POST',
    headers: outsider.headers,
  });
  await request(
    '/body-profiles',
    404,
    json('POST', owner.headers, { name: 'Pending media must be rejected', sourceAssetId: reservation.assetId }),
  );
  await upload(
    reservation,
    imageBytes,
    (fields) => ({ ...fields, key: `staging/${owner.userId}/tampered` }),
    [400, 403],
  );
  await upload(reservation, imageBytes.subarray(0, imageBytes.length - 10), undefined, [400, 403]);
  await upload(reservation, imageBytes);
  passed.push('authenticated and idempotent reservation; ownership, pending-input and signed-policy enforcement');

  const responses = await Promise.all(
    Array.from({ length: 3 }, async () => {
      const response = await fetch(baseUrl + '/media/assets/' + reservation.assetId + '/complete', {
        method: 'POST',
        headers: owner.headers,
      });
      assert.ok([201, 409].includes(response.status));
      return { status: response.status, data: await response.json() };
    }),
  );
  const asset = normalizeEnvelope(responses.find((response) => response.status === 201)?.data);
  assert.ok(asset, 'At least one concurrent finalization must succeed');
  assert.equal(asset.status, 'READY');
  assert.equal(asset.storageDriver, 's3');
  assert.equal(asset.previewData, null);
  assert.equal(asset.objectKey, undefined, 'Storage keys are not API contracts');
  assert.equal(asset.width, 64);
  assert.equal(asset.height, 96);
  assert.equal(
    (await request('/media/assets/' + asset.id + '/complete', 201, { method: 'POST', headers: owner.headers })).id,
    asset.id,
  );
  const stored = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
  const anonymous = await fetch(`${endpoint.origin}/${bucket}/${stored.objectKey}`);
  assert.equal(anonymous.status, 403);
  const read = await fetch(asset.url);
  assert.equal(read.status, 200);
  const cleaned = Buffer.from(await read.arrayBuffer());
  assert.equal(createHash('sha256').update(cleaned).digest('hex'), stored.sha256);
  const metadata = await sharp(cleaned).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
  const signature = new URL(asset.url);
  signature.searchParams.set('X-Amz-Expires', '3600');
  assert.equal((await fetch(signature)).status, 403, 'Tampering with read expiry must invalidate its signature');
  await request('/media/assets/uploads', 409, json('POST', owner.headers, { ...input, byteSize: input.byteSize + 1 }));
  passed.push('concurrent/repeated complete, complete decode/sanitize, private read and signature integrity');

  const post = await request(
    '/community/posts',
    201,
    json('POST', owner.headers, {
      title: 'Storage fixture',
      idempotencyKey: randomUUID(),
      body: 'Private until reviewed',
      imageAssetIds: [asset.id],
      topic: runId,
    }),
  );
  await request('/community/posts/' + post.id, 404);
  const ownPosts = await request('/community/me/posts?limit=5', 200, { headers: owner.headers });
  assert.equal(ownPosts.items.find((item) => item.id === post.id).imagePreviews.length, 1);
  await prisma.user.update({ where: { id: owner.userId }, data: { role: 'ADMIN' } });
  await request(
    '/admin/moderation/posts/' + post.id + '/status',
    200,
    json('PATCH', owner.headers, { status: 'APPROVED', reason: 'Storage acceptance fixture' }),
  );
  const publicPost = await request('/community/posts/' + post.id);
  assert.equal((await fetch(publicPost.imagePreviews[0])).status, 200);
  await request('/community/posts/' + post.id, 200, { method: 'DELETE', headers: owner.headers });
  await request('/community/posts/' + post.id, 404);
  assert.equal((await request('/community/posts?topic=' + runId)).items.length, 0);
  passed.push('own pending preview, approved public signed image, and post deletion stops new URL issuance');

  const invalidBytes = Buffer.from('89504e470d0a1a0a000000000000000000000000', 'hex');
  const invalid = await request(
    '/media/assets/uploads',
    201,
    json('POST', owner.headers, { ...input, byteSize: invalidBytes.length, idempotencyKey: runId + '-invalid' }),
  );
  await upload(invalid, invalidBytes);
  await request('/media/assets/' + invalid.assetId + '/complete', 400, { method: 'POST', headers: owner.headers });
  assert.equal((await prisma.mediaAsset.findUniqueOrThrow({ where: { id: invalid.assetId } })).status, 'REJECTED');
  const expired = await request(
    '/media/assets/uploads',
    201,
    json('POST', owner.headers, { ...input, idempotencyKey: runId + '-expired' }),
  );
  await prisma.mediaAsset.update({
    where: { id: expired.assetId },
    data: { uploadExpiresAt: new Date(Date.now() - 1_000) },
  });
  await request('/media/assets/' + expired.assetId + '/complete', 409, { method: 'POST', headers: owner.headers });
  const stalled = await request(
    '/media/assets/uploads',
    201,
    json('POST', owner.headers, { ...input, idempotencyKey: runId + '-stalled' }),
  );
  await upload(stalled, imageBytes);
  await prisma.mediaAsset.update({
    where: { id: stalled.assetId },
    data: {
      status: 'PROCESSING',
      processingToken: 'old-fixture-token',
      processingStartedAt: new Date(Date.now() - 180_000),
    },
  });
  await request('/media/assets/' + stalled.assetId + '/complete', 201, { method: 'POST', headers: owner.headers });
  passed.push('corrupt image rejected, expired lease refused, interrupted processing lease recovered');

  const raced = await request(
    '/media/assets/uploads',
    201,
    json('POST', owner.headers, { ...input, idempotencyKey: runId + '-delete-race' }),
  );
  await upload(raced, imageBytes);
  const [completion, deletion] = await Promise.all([
    fetch(baseUrl + '/media/assets/' + raced.assetId + '/complete', { method: 'POST', headers: owner.headers }),
    fetch(baseUrl + '/media/assets/' + raced.assetId, { method: 'DELETE', headers: owner.headers }),
  ]);
  assert.ok([201, 404, 409].includes(completion.status));
  assert.equal(deletion.status, 200);
  await request('/media/assets/' + raced.assetId, 404, { headers: owner.headers });
  assert.equal((await prisma.mediaAsset.findUniqueOrThrow({ where: { id: raced.assetId } })).status, 'DELETED');
  passed.push('delete/finalize race cannot resurrect a logically deleted asset');

  await request('/media/assets/' + asset.id, 404, { method: 'DELETE', headers: outsider.headers });
  await request('/media/assets/' + asset.id, 200, { method: 'DELETE', headers: owner.headers });
  await request('/media/assets/' + asset.id, 200, { method: 'DELETE', headers: owner.headers });
  await request('/media/assets/' + asset.id, 404, { headers: owner.headers });
  assert.ok(
    await prisma.objectCleanup.findUnique({ where: { objectKey: stored.objectKey } }),
    'Logical delete must retain durable physical cleanup',
  );
  // Simulate a crashed final write. The worker must reclaim this unreferenced fixture, not an active result.
  const orphanKey = `private/${owner.userId}/fixture-orphan-${runId}.webp`;
  await prisma.objectCleanup.create({ data: { objectKey: orphanKey, notBefore: new Date() } });
  await storage.send(
    new PutObjectCommand({ Bucket: bucket, Key: orphanKey, Body: cleaned, ContentType: 'image/webp' }),
  );
  for (let attempt = 0; attempt < 45; attempt += 1) {
    if ((await missing(stored.objectKey)) && (await missing(orphanKey))) break;
    if (attempt === 44) assert.fail('Actual object cleanup worker did not converge');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.equal(await prisma.objectCleanup.count({ where: { objectKey: { in: [stored.objectKey, orphanKey] } } }), 0);
  assert.equal((await prisma.mediaAsset.findUniqueOrThrow({ where: { id: expired.assetId } })).status, 'EXPIRED');
  const live = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: stalled.assetId } });
  assert.equal(await missing(live.objectKey), false, 'Cleanup must not delete active READY objects');
  passed.push('idempotent logical delete, actual physical deletion, orphan collection and live-object protection');
  console.log(
    JSON.stringify(
      { mode: 'real local S3/PostgreSQL/Nest HTTP, not AI or production acceptance', requests, passed },
      null,
      2,
    ),
  );
} finally {
  // Only unique users/keys created by this run are removed; no bucket/public-schema reset.
  const cleanupErrors = [];
  for (const userId of users) {
    for (const prefix of [`staging/${userId}/`, `private/${userId}/`]) {
      try {
        let cursor;
        do {
          const objects = await storage.send(
            new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: cursor }),
          );
          for (const object of objects.Contents ?? []) {
            assert.ok(object.Key.startsWith(prefix));
            await storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }));
          }
          cursor = objects.NextContinuationToken;
        } while (cursor);
        await prisma.objectCleanup.deleteMany({ where: { objectKey: { startsWith: prefix } } });
      } catch (error) {
        cleanupErrors.push(error);
        const assets = await prisma.mediaAsset.findMany({
          where: { ownerId: userId, storageDriver: 's3', status: 'READY' },
          select: { objectKey: true },
        });
        for (const asset of assets)
          await prisma.objectCleanup.upsert({
            where: { objectKey: asset.objectKey },
            create: { objectKey: asset.objectKey, notBefore: new Date() },
            update: { notBefore: new Date() },
          });
      }
    }
    await prisma.post.deleteMany({ where: { authorId: userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  await prisma.$disconnect();
  storage.destroy();
  if (cleanupErrors.length) {
    console.error('Fixture storage cleanup failed; database fixtures removed and durable object retries retained');
    process.exitCode = 1;
  }
}
