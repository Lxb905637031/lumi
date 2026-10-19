import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { TryOnWorkflow } from '../../miniapp/src/features/try-on/try-on-workflow.ts';
import { ApiRequestError } from '../../miniapp/src/services/api-request-error.ts';

// Exercises the actual miniapp workflow against HTTP. It deliberately does not claim Taro runtime/UI acceptance.
assert.notEqual(process.env.NODE_ENV, 'production');
const baseUrl = process.env.LUMI_API_URL ?? 'http://127.0.0.1:4300/api/v1';
for (const value of [baseUrl, process.env.DATABASE_URL]) {
  assert.ok(value, 'Local API and database are required');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname), 'Local fixtures only');
}
const db = new PrismaClient();
const runId = randomUUID();
let userId;
let accessToken;
let requests = 0;
let confirmation;
let loseFirstResponse = true;
const submitted = [];
async function request(path, method = 'GET', body) {
  requests += 1;
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(accessToken ? { authorization: 'Bearer ' + accessToken } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json();
  if (!response.ok) throw new ApiRequestError(data.message ?? 'HTTP failure', response.status, data.code);
  return data;
}
async function upload(bytes) {
  const reservation = await request('/media/assets/uploads', 'POST', {
    fileName: 'workflow.png',
    mimeType: 'image/png',
    byteSize: bytes.length,
    idempotencyKey: randomUUID(),
  });
  const form = new FormData();
  for (const [key, value] of Object.entries(reservation.upload.fields)) form.append(key, value);
  form.append('file', new Blob([bytes], { type: 'image/png' }), 'workflow.png');
  assert.equal(
    (await fetch(reservation.upload.url, { method: 'POST', body: form, signal: AbortSignal.timeout(15_000) })).status,
    201,
  );
  return request('/media/assets/' + reservation.assetId + '/complete', 'POST');
}
try {
  const bootstrap = await request('/system/bootstrap');
  assert.equal(bootstrap.freeMode, true);
  assert.equal(bootstrap.media.uploadMode, 'signed-post');
  const session = await request('/auth/wechat/login', 'POST', { code: 'local:client-workflow:' + runId });
  userId = session.user.id;
  accessToken = session.accessToken;
  const bytes = await sharp({ create: { width: 32, height: 48, channels: 3, background: '#aabbcc' } })
    .png()
    .toBuffer();
  const person = await upload(bytes);
  const garment = await upload(bytes);
  const profile = await request('/body-profiles', 'POST', {
    name: 'Workflow person',
    heightCm: 170,
    sourceAssetId: person.id,
  });
  const clothing = await request('/wardrobe/items', 'POST', {
    name: 'Workflow shirt',
    category: 'TOP',
    assetId: garment.id,
  });
  const flow = new TryOnWorkflow({
    login: async () => {},
    sessionEpoch: () => 1,
    profiles: async (cursor) =>
      request('/body-profiles?limit=20' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')),
    clothing: async (cursor) =>
      request('/wardrobe/items?limit=20' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')),
    quota: () => request('/quota'),
    create: async (input) => {
      submitted.push({ ...input });
      const result = await request('/generation-jobs', 'POST', input);
      if (loseFirstResponse) {
        loseFirstResponse = false;
        throw new Error('fixture: response lost after server commit');
      }
      return result;
    },
    read: (id) => request('/generation-jobs/' + id),
    retry: (id) => request('/generation-jobs/' + id + '/retry', 'POST', {}),
    cancel: (id) => request('/generation-jobs/' + id + '/cancel', 'POST', {}),
    confirm: async (message) => {
      confirmation = message;
      return true;
    },
    key: () => randomUUID(),
  });
  await flow.prepare();
  assert.equal(flow.snapshot().profileVersionId, undefined);
  flow.selectProfile(profile.id);
  flow.selectClothing(clothing.id);
  await flow.start();
  assert.match(flow.snapshot().error, /response lost/);
  assert.ok(flow.snapshot().pendingInput);
  assert.match(confirmation, /Workflow person v1/);
  assert.match(confirmation, /Workflow shirt/);
  await flow.start();
  assert.deepEqual(submitted[0], submitted[1]);
  for (let i = 0; i < 30 && flow.snapshot().job?.status !== 'SUCCEEDED'; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await flow.refreshJob();
  }
  assert.equal(flow.snapshot().job.status, 'SUCCEEDED');
  assert.equal(flow.snapshot().pendingInput, undefined);
  assert.equal(flow.snapshot().quota.available, 4);
  assert.equal(flow.snapshot().quota.consumed, 1);
  assert.equal(await db.generationJob.count({ where: { userId } }), 1);
  assert.equal(await db.quotaLedger.count({ where: { userId, type: 'COMMIT' } }), 1);
  flow.leave();
  console.log(
    JSON.stringify(
      {
        mode: 'miniapp headless workflow + real HTTP/S3/PostgreSQL/Redis, local-svg only',
        requests,
        passed: [
          'explicit photo/profile/clothing selection and quota confirmation',
          'lost create response followed by same-key recovery',
          'one persisted job, one consumption, terminal status and balance synchronized',
        ],
        notAccepted: [
          'Taro request transport',
          'native Picker/dialog rendering',
          'WeChat device/network lifecycle',
          'real AI',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  if (userId) {
    const assets = await db.mediaAsset.findMany({
      where: { ownerId: userId, storageDriver: 's3' },
      select: { objectKey: true },
    });
    for (const asset of assets)
      await db.objectCleanup.upsert({
        where: { objectKey: asset.objectKey },
        create: { objectKey: asset.objectKey, notBefore: new Date() },
        update: { notBefore: new Date() },
      });
    await db.generationJob.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
  }
  await db.$disconnect();
}
