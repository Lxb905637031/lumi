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
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
  return normalizeEnvelope(result);
}

async function login(label) {
  const session = await request('/auth/wechat/login', undefined, 201, 'POST', {
    code: `local:comment-moderation:${runId}:${label}`,
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
  const author = await login('author');
  const moderatorFixture = await login('moderator');
  await db.user.update({ where: { id: moderatorFixture.user.id }, data: { role: 'MODERATOR' } });
  const username = `comment-moderation-${runId}`;
  const password = `local-${runId}-moderator`;
  await db.adminCredential.create({
    data: { userId: moderatorFixture.user.id, username, passwordHash: await hashPassword(password) },
  });
  const moderator = await request('/auth/admin/login', undefined, 201, 'POST', { username, password });
  const post = await db.post.create({
    data: {
      authorId: author.user.id,
      title: `Comment moderation ${runId}`,
      body: 'Disposable integration fixture',
      moderationStatus: 'APPROVED',
    },
  });
  postId = post.id;

  const baseDate = Date.UTC(2026, 0, 1);
  const comments = await Promise.all(
    Array.from({ length: 4 }, (_, index) =>
      db.comment.create({
        data: {
          postId: post.id,
          authorId: author.user.id,
          body: `Moderation fixture ${index}`,
          moderationStatus: index === 3 ? 'APPROVED' : 'PENDING',
          createdAt: new Date(baseDate + index * 1000),
        },
        select: { id: true, moderationStatus: true },
      }),
    ),
  );

  await request('/admin/moderation/comments', author.accessToken, 403);
  await request('/admin/moderation/comments?status=INVALID', moderator.accessToken, 400);
  await request('/admin/moderation/comments?limit=100', moderator.accessToken, 400);
  const queuePath = `/admin/moderation/comments?status=PENDING&limit=2`;
  const firstPage = await request(queuePath, moderator.accessToken);
  assert.equal(firstPage.items.length, 2);
  assert.ok(firstPage.nextCursor);
  const secondPage = await request(
    `${queuePath}&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
    moderator.accessToken,
  );
  assert.equal(secondPage.items.length, 1);
  assert.equal(new Set([...firstPage.items, ...secondPage.items].map((row) => row.id)).size, 3);
  assert.ok([...firstPage.items, ...secondPage.items].every((row) => row.moderationStatus === 'PENDING'));

  const targetId = comments[0].id;
  await request(`/admin/moderation/comments/${targetId}/status`, author.accessToken, 403, 'PATCH', {
    status: 'APPROVED',
  });
  const approved = await request(`/admin/moderation/comments/${targetId}/status`, moderator.accessToken, 200, 'PATCH', {
    status: 'APPROVED',
    reason: '通过集成审核',
  });
  assert.deepEqual(approved, { id: targetId, status: 'APPROVED' });
  await request(`/admin/moderation/comments/${targetId}/actions`, author.accessToken, 403);
  const approvalActions = await request(
    `/admin/moderation/comments/${targetId}/actions?limit=20`,
    moderator.accessToken,
  );
  assert.equal(approvalActions.items.length, 1);
  assert.deepEqual(Object.keys(approvalActions.items[0]).sort(), [
    'actorId',
    'createdAt',
    'fromStatus',
    'id',
    'reason',
    'toStatus',
  ]);
  assert.deepEqual(
    {
      actorId: approvalActions.items[0].actorId,
      fromStatus: approvalActions.items[0].fromStatus,
      toStatus: approvalActions.items[0].toStatus,
      reason: approvalActions.items[0].reason,
    },
    { actorId: moderator.user.id, fromStatus: 'PENDING', toStatus: 'APPROVED', reason: '通过集成审核' },
  );
  assert.equal(
    (await request('/admin/moderation/comments?status=PENDING&limit=20', moderator.accessToken)).items.length,
    2,
  );
  const approvedQueue = await request('/admin/moderation/comments?status=APPROVED&limit=20', moderator.accessToken);
  assert.ok(approvedQueue.items.some((row) => row.id === targetId));

  await request(`/admin/moderation/comments/${targetId}/status`, moderator.accessToken, 200, 'PATCH', {
    status: 'REMOVED',
    reason: '用户举报后复核下架',
  });
  const removedQueue = await request('/admin/moderation/comments?status=REMOVED&limit=20', moderator.accessToken);
  assert.ok(removedQueue.items.some((row) => row.id === targetId));
  const audit = await db.commentModerationAction.findMany({
    where: { commentId: targetId },
    orderBy: { createdAt: 'asc' },
    select: { fromStatus: true, toStatus: true, reason: true, actorId: true },
  });
  assert.deepEqual(
    audit.map(({ fromStatus, toStatus }) => [fromStatus, toStatus]),
    [
      ['PENDING', 'APPROVED'],
      ['APPROVED', 'REMOVED'],
    ],
  );
  assert.deepEqual(
    audit.map((row) => row.reason),
    ['通过集成审核', '用户举报后复核下架'],
  );
  assert.ok(audit.every((row) => row.actorId === moderator.user.id));
  const actionPage = await request(`/admin/moderation/comments/${targetId}/actions?limit=1`, moderator.accessToken);
  assert.equal(actionPage.items.length, 1);
  assert.ok(actionPage.nextCursor);
  const actionPageTwo = await request(
    `/admin/moderation/comments/${targetId}/actions?limit=1&cursor=${encodeURIComponent(actionPage.nextCursor)}`,
    moderator.accessToken,
  );
  assert.equal(actionPageTwo.items.length, 1);
  assert.notEqual(actionPage.items[0].id, actionPageTwo.items[0].id);
  assert.equal(
    await db.notification.count({ where: { userId: author.user.id, targetId: post.id, type: 'MODERATION' } }),
    2,
  );

  console.log(
    JSON.stringify(
      {
        requests,
        passed: [
          'moderator RBAC and invalid filter/page-size rejection',
          'status-filtered cursor pagination without duplicates',
          'approval moves comments between status queues',
          'approved comment removal and immutable actor/reason audit trail',
          'audit history HTTP RBAC, transition fields and cursor pagination',
          'each moderation transition notifies the comment author',
        ],
        mode: 'Real loopback HTTP/PostgreSQL with disposable local fixtures; no external services',
      },
      null,
      2,
    ),
  );
} finally {
  if (postId) await db.post.delete({ where: { id: postId } }).catch(() => undefined);
  if (users.length) await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
