import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { PostComposerWorkflow } from '../../miniapp/src/features/community/post-composer-workflow.ts';
import { ApiRequestError } from '../../miniapp/src/services/api-request-error.ts';
import { normalizeEnvelope } from './api-envelope.mjs';

assert.notEqual(process.env.NODE_ENV, 'production');
const baseUrl = process.env.LUMI_API_URL ?? 'http://127.0.0.1:4300/api/v1';
for (const target of [baseUrl, process.env.DATABASE_URL]) {
  assert.ok(target);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(target).hostname), 'Local fixtures only');
}
const db = new PrismaClient();
const runId = randomUUID();
const users = [];
let requests = 0;
async function request(path, token, method = 'GET', body) {
  requests += 1;
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  const normalized = normalizeEnvelope(data);
  if (!response.ok) throw new ApiRequestError(normalized.message, response.status, normalized.code);
  return normalized;
}
async function expectStatus(action, status) {
  await assert.rejects(action, (error) => error instanceof ApiRequestError && error.statusCode === status);
}
async function login(label) {
  const result = await request('/auth/wechat/login', null, 'POST', { code: `local:publishing:${runId}:${label}` });
  users.push(result.user.id);
  return result;
}
async function upload(token) {
  const bytes = await sharp({ create: { width: 24, height: 32, channels: 3, background: '#abc' } })
    .png()
    .toBuffer();
  const reserved = await request('/media/assets/uploads', token, 'POST', {
    fileName: 'post.png',
    mimeType: 'image/png',
    byteSize: bytes.length,
    idempotencyKey: randomUUID(),
  });
  const form = new FormData();
  for (const [key, value] of Object.entries(reserved.upload.fields)) form.append(key, value);
  form.append('file', new Blob([bytes], { type: 'image/png' }), 'post.png');
  assert.equal(
    (await fetch(reserved.upload.url, { method: 'POST', body: form, signal: AbortSignal.timeout(15000) })).status,
    201,
  );
  return request('/media/assets/' + reserved.assetId + '/complete', token, 'POST');
}
try {
  const owner = await login('owner');
  const outsider = await login('outsider');
  const asset = await upload(owner.accessToken);
  const otherAsset = await upload(outsider.accessToken);
  const submitted = [];
  let loseResponse = true;
  let confirmations = 0;
  const flow = new PostComposerWorkflow({
    login: async () => {},
    sessionEpoch: () => 1,
    key: () => randomUUID(),
    choose: async () => ['fixture-selected-image'],
    upload: async () => ({ id: asset.id, preview: asset.url }),
    source: async () => {
      throw new Error('Not a generated-source fixture');
    },
    confirm: async () => {
      confirmations += 1;
      return true;
    },
    create: async (input) => {
      submitted.push(structuredClone(input));
      const post = await request('/community/posts', owner.accessToken, 'POST', input);
      if (loseResponse) {
        loseResponse = false;
        throw new Error('fixture: response lost after committed publication');
      }
      return post;
    },
  });
  await flow.prepare();
  flow.edit({ title: '  Publication fixture  ', body: '  Keep the original content  ', topic: runId });
  await flow.addImages();
  await flow.submit();
  assert.ok(flow.snapshot().pending);
  assert.match(flow.snapshot().error, /response lost/);
  const input = structuredClone(flow.snapshot().pending);
  assert.equal(input.title, 'Publication fixture');
  flow.edit({ body: 'Must not change while unknown' });
  const copies = await Promise.all(
    Array.from({ length: 5 }, () => request('/community/posts', owner.accessToken, 'POST', input)),
  );
  assert.equal(new Set(copies.map((post) => post.id)).size, 1);
  assert.equal(await db.post.count({ where: { authorId: owner.user.id } }), 1);
  flow.leave();
  flow.resume();
  await flow.submit();
  const post = flow.snapshot().post;
  assert.equal(post.id, copies[0].id);
  assert.equal(post.moderationStatus, 'PENDING');
  assert.deepEqual(submitted[0], submitted[1]);
  assert.equal(confirmations, 1);
  await expectStatus(() => request('/community/posts', owner.accessToken, 'POST', { ...input, title: 'Changed' }), 409);
  await expectStatus(
    () => request('/community/posts', owner.accessToken, 'POST', { ...input, idempotencyKey: undefined }),
    400,
  );
  await expectStatus(
    () =>
      request('/community/posts', owner.accessToken, 'POST', { ...input, idempotencyKey: randomUUID(), body: '  ' }),
    400,
  );
  await expectStatus(() => request('/community/posts', outsider.accessToken, 'POST', input), 404);
  const otherPost = await request('/community/posts', outsider.accessToken, 'POST', {
    ...input,
    imageAssetIds: [otherAsset.id],
  });
  assert.notEqual(otherPost.id, post.id, 'The same key is scoped to its owner');
  // Test-only role assignment; moderation still runs through the real guarded/audited HTTP endpoint.
  await db.user.update({ where: { id: outsider.user.id }, data: { role: 'ADMIN' } });
  await request('/admin/moderation/posts/' + post.id + '/status', outsider.accessToken, 'PATCH', {
    status: 'APPROVED',
    reason: 'Publishing regression',
  });
  assert.equal((await request('/community/posts', owner.accessToken, 'POST', input)).moderationStatus, 'APPROVED');
  await request('/community/posts/' + post.id, owner.accessToken, 'DELETE');
  await expectStatus(() => request('/community/posts', owner.accessToken, 'POST', input), 409);
  assert.equal(await db.post.count({ where: { authorId: owner.user.id } }), 1);
  assert.ok((await db.post.findUniqueOrThrow({ where: { id: post.id } })).deletedAt);
  console.log(
    JSON.stringify(
      {
        requests,
        passed: [
          'same miniapp use case recovers a lost committed response',
          'five concurrent same-key writes create one post',
          'key/input conflicts, required key and nonblank DTOs',
          'owner-scoped key and image authorization',
          'moderation replay returns current status; deleted request never resurrects',
        ],
        notAccepted: ['Taro transport/native image picker/modal', 'WeChat sharing/device lifecycle', 'real AI'],
        fixtures:
          'actual local HTTP/PostgreSQL/S3; file chooser/upload adapter injected with separately uploaded fixture assets',
      },
      null,
      2,
    ),
  );
} finally {
  for (const id of users) {
    const assets = await db.mediaAsset.findMany({
      where: { ownerId: id, storageDriver: 's3' },
      select: { objectKey: true },
    });
    for (const asset of assets)
      await db.objectCleanup.upsert({
        where: { objectKey: asset.objectKey },
        create: { objectKey: asset.objectKey, notBefore: new Date() },
        update: { notBefore: new Date() },
      });
    await db.user.delete({ where: { id } });
  }
  await db.$disconnect();
}
