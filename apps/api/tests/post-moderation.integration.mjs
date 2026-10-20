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
    code: `local:post-moderation:${runId}:${label}`,
  });
  users.push(session.user.id);
  return session;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await promisify(scrypt)(password, salt, 64);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

async function createPost(authorId, suffix, moderationStatus = 'PENDING') {
  const post = await db.post.create({
    data: {
      authorId,
      title: `审核验收 ${suffix}`,
      body: `Disposable post moderation fixture ${suffix}`,
      topic: runId,
      moderationStatus,
    },
  });
  postIds.push(post.id);
  return post;
}

try {
  assert.equal((await request('/system/bootstrap')).freeMode, true);
  const owner = await login('owner');
  const regular = await login('regular');
  const adminFixture = await login('admin');
  await db.user.update({ where: { id: adminFixture.user.id }, data: { role: 'ADMIN' } });
  const username = `post-moderation-${runId}`;
  const password = `local-${runId}-admin`;
  await db.adminCredential.create({
    data: { userId: adminFixture.user.id, username, passwordHash: await hashPassword(password) },
  });
  const admin = await request('/auth/admin/login', undefined, 201, 'POST', { username, password });

  const pending = await Promise.all(
    Array.from({ length: 3 }, (_, index) => createPost(owner.user.id, `${index}-${runId}`)),
  );
  const alreadyApproved = await createPost(owner.user.id, `approved-${runId}`, 'APPROVED');
  await request('/admin/moderation/posts', regular.accessToken, 403);
  await request('/admin/moderation/posts?status=INVALID', admin.accessToken, 400);
  const firstPage = await request('/admin/moderation/posts?status=PENDING&limit=2', admin.accessToken);
  assert.equal(firstPage.items.length, 2);
  const secondPage = await request(
    `/admin/moderation/posts?status=PENDING&limit=2&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
    admin.accessToken,
  );
  const pendingIds = new Set([...firstPage.items, ...secondPage.items].map((post) => post.id));
  assert.equal(pendingIds.size, 3);
  assert.ok(pending.every((post) => pendingIds.has(post.id)));

  const rejectedId = pending[0].id;
  await request(`/admin/moderation/posts/${rejectedId}/status`, regular.accessToken, 403, 'PATCH', {
    status: 'REJECTED',
    reason: 'RBAC check',
  });
  await request(`/admin/moderation/posts/${rejectedId}/status`, admin.accessToken, 200, 'PATCH', {
    status: 'REJECTED',
    reason: '不符合社区规范',
  });
  const approvedId = pending[1].id;
  await request(`/admin/moderation/posts/${approvedId}/status`, admin.accessToken, 200, 'PATCH', {
    status: 'APPROVED',
    reason: '内容合规',
  });
  const removed = await request(
    `/admin/moderation/posts/${alreadyApproved.id}/status`,
    admin.accessToken,
    200,
    'PATCH',
    {
      status: 'REMOVED',
      reason: '复核下架',
    },
  );
  assert.equal(removed.status, 'REMOVED');

  const rejectedQueue = await request('/admin/moderation/posts?status=REJECTED&limit=20', admin.accessToken);
  const approvedQueue = await request('/admin/moderation/posts?status=APPROVED&limit=20', admin.accessToken);
  const removedQueue = await request('/admin/moderation/posts?status=REMOVED&limit=20', admin.accessToken);
  assert.ok(rejectedQueue.items.some((post) => post.id === rejectedId));
  assert.ok(approvedQueue.items.some((post) => post.id === approvedId));
  assert.ok(removedQueue.items.some((post) => post.id === alreadyApproved.id));

  const publicFeed = await request(`/community/posts?topic=${encodeURIComponent(runId)}&limit=20`);
  assert.ok(publicFeed.items.some((post) => post.id === approvedId));
  assert.ok(!publicFeed.items.some((post) => post.id === rejectedId || post.id === alreadyApproved.id));
  const audit = await db.moderationAction.findMany({
    where: { postId: { in: [rejectedId, approvedId, alreadyApproved.id] } },
    select: { postId: true, actorId: true, fromStatus: true, toStatus: true, reason: true },
  });
  assert.equal(audit.length, 3);
  assert.ok(audit.every((action) => action.actorId === admin.user.id && action.reason));
  assert.equal(
    await db.notification.count({ where: { userId: owner.user.id, targetId: { in: postIds }, type: 'MODERATION' } }),
    3,
  );

  console.log(
    JSON.stringify(
      {
        requests,
        passed: [
          'moderator RBAC and invalid status rejection',
          'status-filtered cursor pagination without duplicates',
          'approve/reject/remove state transitions and queue membership',
          'approved-only public feed excludes rejected and removed posts',
          'moderation actor/reason audit and author notifications',
        ],
        mode: 'Real loopback HTTP/PostgreSQL with disposable local fixtures; no external services',
      },
      null,
      2,
    ),
  );
} finally {
  if (postIds.length) await db.post.deleteMany({ where: { id: { in: postIds } } });
  if (users.length) await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
