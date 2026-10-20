import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { normalizeEnvelope } from './api-envelope.mjs';
import { databaseTarget } from '../scripts/migration-tools.mjs';

assert.notEqual(process.env.NODE_ENV, 'production');
databaseTarget(process.env.DATABASE_URL);
const baseUrl = process.env.LUMI_API_URL ?? 'http://127.0.0.1:4300/api/v1';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname));
const db = new PrismaClient();
const runId = randomUUID();
const users = [];
let challengeId;
let assetId;
let postId;
let requests = 0;

async function request(path, token, status = 200, method = 'GET', body) {
  requests += 1;
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  assert.ok(data.meta?.requestId, `${method} ${path} response must expose a request ID`);
  assert.equal(response.headers.get('x-request-id'), data.meta.requestId, 'Header and envelope IDs must match');
  return normalizeEnvelope(data);
}

async function login(label) {
  const session = await request('/auth/wechat/login', undefined, 201, 'POST', {
    code: `local:challenge:${runId}:${label}`,
  });
  users.push(session.user.id);
  return session;
}

async function upload(token) {
  const bytes = await sharp({ create: { width: 24, height: 32, channels: 3, background: '#9b405b' } })
    .png()
    .toBuffer();
  const reserved = await request('/media/assets/uploads', token, 201, 'POST', {
    fileName: 'challenge.png',
    mimeType: 'image/png',
    byteSize: bytes.length,
    idempotencyKey: randomUUID(),
  });
  const form = new FormData();
  for (const [key, value] of Object.entries(reserved.upload.fields)) form.append(key, value);
  form.append('file', new Blob([bytes], { type: 'image/png' }), 'challenge.png');
  assert.equal(
    (await fetch(reserved.upload.url, { method: 'POST', body: form, signal: AbortSignal.timeout(15000) })).status,
    201,
  );
  return request(`/media/assets/${reserved.assetId}/complete`, token, 201, 'POST');
}

try {
  const owner = await login('owner');
  const admin = await login('admin');
  await db.user.update({ where: { id: admin.user.id }, data: { role: 'ADMIN' } });
  await request('/admin/challenges', owner.accessToken, 403, 'POST', {
    slug: `forbidden-${runId.slice(0, 8)}`,
    title: 'Forbidden challenge',
    description: 'Should not be created by a regular user.',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  const media = await upload(owner.accessToken);
  assetId = media.id;
  const created = await request('/admin/challenges', admin.accessToken, 201, 'POST', {
    slug: `challenge-${runId.slice(0, 8)}`,
    title: '莓红一周挑战',
    description: '用一件莓红单品完成你的通勤组合。',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  challengeId = created.id;
  await request(`/admin/challenges/${challengeId}/publish`, admin.accessToken, 201, 'POST');
  await request('/admin/challenges?status=NOT_A_STATUS', admin.accessToken, 400);
  const adminPage = await request(`/admin/challenges?status=PUBLISHED&limit=1`, admin.accessToken);
  assert.equal(adminPage.items[0].id, challengeId);
  await request('/admin/challenges', owner.accessToken, 403);
  await request('/community/posts', owner.accessToken, 409, 'POST', {
    idempotencyKey: `challenge-before-join-${runId}`,
    title: 'Not joined yet',
    body: '投稿前に参加が必要です。',
    imageAssetIds: [media.id],
    challengeSlug: created.slug,
  });
  const challenge = await request('/challenges', undefined);
  assert.equal(challenge[0].slug, created.slug);
  const joined = await request(`/challenges/${created.slug}/participation`, owner.accessToken, 200, 'PUT', {
    active: true,
  });
  assert.equal(joined.active, true);
  const repeatedJoin = await request(`/challenges/${created.slug}/participation`, owner.accessToken, 200, 'PUT', {
    active: true,
  });
  assert.equal(repeatedJoin.joinedAt, joined.joinedAt, 'Joining twice must preserve the original participation time');
  const post = await request('/community/posts', owner.accessToken, 201, 'POST', {
    idempotencyKey: `challenge-post-${runId}`,
    title: '我的莓红通勤',
    body: '一件外套完成一周穿搭。',
    imageAssetIds: [assetId],
    challengeSlug: created.slug,
  });
  postId = post.id;
  assert.equal(post.challengeId, challengeId);
  const challengeReview = await request(
    `/admin/moderation/posts?status=PENDING&challengeId=${challengeId}`,
    admin.accessToken,
  );
  assert.deepEqual(
    challengeReview.items.map((item) => item.id),
    [postId],
  );
  assert.equal(
    (await request(`/admin/challenges?status=PUBLISHED`, admin.accessToken)).items.find(
      (item) => item.id === challengeId,
    ).pendingPostCount,
    1,
  );
  await request(`/admin/moderation/posts/${postId}/status`, admin.accessToken, 200, 'PATCH', {
    status: 'APPROVED',
    reason: 'Challenge submission approved',
  });
  await request(`/challenges/${created.slug}/participation`, owner.accessToken, 409, 'PUT', { active: false });
  await request(`/admin/challenges/${challengeId}/close`, admin.accessToken, 200, 'PATCH');
  console.log(
    JSON.stringify(
      {
        requests,
        passed: [
          'admin challenge lifecycle',
          'admin-only operations and regular-user authorization rejection',
          'real signed local object upload and media ownership',
          'posting rejected before participation and accepted after join',
          'admin challenge pagination, challenge-scoped moderation queue and audited review action',
          'idempotent participation and exit protection after submission',
        ],
        mode: 'Real loopback HTTP/PostgreSQL with disposable media and users; no external services',
      },
      null,
      2,
    ),
  );
} finally {
  if (postId) await db.post.delete({ where: { id: postId } }).catch(() => undefined);
  if (challengeId) await db.challenge.delete({ where: { id: challengeId } }).catch(() => undefined);
  if (assetId) await db.mediaAsset.delete({ where: { id: assetId } }).catch(() => undefined);
  if (users.length) await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
