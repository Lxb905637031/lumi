import assert from 'node:assert/strict';
import { randomBytes, randomUUID, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
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
const postIds = [];
const commentIds = [];
const assetIds = [];
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
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
  return normalizeEnvelope(result);
}

async function login(label) {
  const session = await request('/auth/wechat/login', undefined, 201, 'POST', {
    code: `local:audit-search:${runId}:${label}`,
  });
  users.push(session.user.id);
  return session;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await promisify(scrypt)(password, salt, 64);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

try {
  assert.equal((await request('/system/bootstrap')).freeMode, true);
  const subject = await login('subject');
  const adminFixture = await login('admin');
  await db.user.update({ where: { id: adminFixture.user.id }, data: { role: 'ADMIN' } });
  const username = `audit-search-${runId}`;
  const password = `local-${runId}-admin`;
  await db.adminCredential.create({
    data: { userId: adminFixture.user.id, username, passwordHash: await hashPassword(password) },
  });
  const admin = await request('/auth/admin/login', undefined, 201, 'POST', { username, password });

  const post = await db.post.create({
    data: {
      authorId: subject.user.id,
      title: `Audit ${runId}`,
      body: 'Disposable audit fixture',
      moderationStatus: 'PENDING',
    },
  });
  postIds.push(post.id);
  const comment = await db.comment.create({
    data: { postId: post.id, authorId: subject.user.id, body: 'Disposable audit comment', moderationStatus: 'PENDING' },
  });
  commentIds.push(comment.id);
  const asset = await db.mediaAsset.create({
    data: {
      ownerId: subject.user.id,
      objectKey: `audit-search/${runId}.jpg`,
      status: 'READY',
      reviewStatus: 'UNREVIEWED',
      mimeType: 'image/jpeg',
      byteSize: 128,
      sha256: runId.replaceAll('-', '').padEnd(64, '0').slice(0, 64),
    },
  });
  assetIds.push(asset.id);

  await db.moderationAction.create({
    data: {
      postId: post.id,
      actorId: admin.user.id,
      fromStatus: 'PENDING',
      toStatus: 'APPROVED',
      reason: `post-${runId}`,
    },
  });
  await db.commentModerationAction.create({
    data: {
      commentId: comment.id,
      actorId: admin.user.id,
      fromStatus: 'PENDING',
      toStatus: 'REJECTED',
      reason: `comment-${runId}`,
    },
  });
  await db.mediaReviewAction.create({
    data: {
      assetId: asset.id,
      actorId: admin.user.id,
      fromStatus: 'UNREVIEWED',
      toStatus: 'APPROVED',
      reason: `media-${runId}`,
    },
  });
  await db.userModerationAction.create({
    data: {
      userId: subject.user.id,
      actorId: admin.user.id,
      fromStatus: 'ACTIVE',
      toStatus: 'ACTIVE',
      fromRole: 'USER',
      toRole: 'MODERATOR',
      reason: `user-${runId}`,
    },
  });

  await request('/admin/audit?limit=20', subject.accessToken, 403);
  await request('/admin/audit?type=UNKNOWN', admin.accessToken, 400);
  await request('/admin/audit?limit=100', admin.accessToken, 400);
  const all = await request(`/admin/audit?actorId=${admin.user.id}&limit=2`, admin.accessToken);
  assert.equal(all.items.length, 2);
  assert.ok(all.nextCursor);
  const rest = await request(
    `/admin/audit?actorId=${admin.user.id}&limit=2&cursor=${encodeURIComponent(all.nextCursor)}`,
    admin.accessToken,
  );
  const rows = [...all.items, ...rest.items];
  assert.equal(rows.length, 4);
  assert.equal(new Set(rows.map((row) => `${row.type}:${row.id}`)).size, 4);
  assert.deepEqual(new Set(rows.map((row) => row.type)), new Set(['POST', 'COMMENT', 'MEDIA', 'USER']));
  assert.ok(rows.every((row) => row.actorId === admin.user.id));
  assert.ok(
    rows.every(
      (row) =>
        JSON.stringify(Object.keys(row).sort()) ===
        JSON.stringify(['actorId', 'createdAt', 'fromStatus', 'id', 'reason', 'targetId', 'toStatus', 'type']),
    ),
  );
  assert.ok(rows.every((row) => !('objectKey' in row) && !('email' in row) && !('previewData' in row)));

  const commentOnly = await request(`/admin/audit?type=COMMENT&targetId=${comment.id}`, admin.accessToken);
  assert.equal(commentOnly.items.length, 1);
  assert.equal(commentOnly.items[0].reason, `comment-${runId}`);
  const userOnly = await request(`/admin/audit?type=USER&targetId=${subject.user.id}`, admin.accessToken);
  assert.equal(userOnly.items[0].fromStatus, 'ACTIVE / USER');
  assert.equal(userOnly.items[0].toStatus, 'ACTIVE / MODERATOR');
  await request('/admin/audit?cursor=invalid', admin.accessToken, 400);

  console.log(
    JSON.stringify(
      {
        requests,
        passed: [
          'admin RBAC and query validation',
          'four audit sources return a stable unified cursor page without duplicates',
          'actor, type and target filters',
          'user role transitions are visible',
          'audit response has an explicit field allowlist and omits media/account sensitive fields',
        ],
        mode: 'Real loopback HTTP/PostgreSQL with disposable local fixtures; no external services',
      },
      null,
      2,
    ),
  );
} finally {
  if (assetIds.length) await db.mediaAsset.deleteMany({ where: { id: { in: assetIds } } });
  if (postIds.length) await db.post.deleteMany({ where: { id: { in: postIds } } });
  if (users.length) await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
