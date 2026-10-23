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
const users = [];
const runId = randomUUID();
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
  const result = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
  return normalizeEnvelope(result);
}

async function login(name) {
  const session = await request('/auth/wechat/login', undefined, 201, 'POST', {
    code: `local:announcement:${runId}:${name}`,
  });
  users.push(session.user.id);
  return session;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await promisify(scrypt)(password, salt, 64);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

async function waitForSent(id, token) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await request(`/admin/announcements/${id}`, token);
    if (result.status === 'SENT') return result;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail('announcement did not reach SENT within 3 seconds');
}

try {
  assert.equal((await request('/system/bootstrap')).freeMode, true);
  const owner = await login('owner');
  const recipient = await login('recipient');
  const adminFixture = await login('admin');
  await db.user.update({ where: { id: adminFixture.user.id }, data: { role: 'ADMIN' } });
  const username = `announcement-${runId}`;
  const password = `local-${runId}-admin`;
  await db.adminCredential.create({
    data: { userId: adminFixture.user.id, username, passwordHash: await hashPassword(password) },
  });
  const admin = await request('/auth/admin/login', undefined, 201, 'POST', { username, password });
  const activeUserCount = await db.user.count({ where: { status: 'ACTIVE' } });

  await request('/admin/announcements', owner.accessToken, 403);
  const key = randomUUID();
  const draftInput = { idempotencyKey: key, title: '服务升级通知', body: '周五凌晨进行维护。' };
  const draft = await request('/admin/announcements', admin.accessToken, 201, 'POST', draftInput);
  const duplicate = await request('/admin/announcements', admin.accessToken, 201, 'POST', draftInput);
  assert.equal(duplicate.id, draft.id, 'repeated draft creation must return the same resource');
  assert.equal(draft.status, 'DRAFT');
  await request(`/admin/announcements/${draft.id}`, admin.accessToken, 200, 'PATCH', {
    expectedVersion: 1,
    title: '服务升级通知（更新）',
    body: '维护时间：周五凌晨。',
  });
  await request(`/admin/announcements/${draft.id}`, admin.accessToken, 409, 'PATCH', {
    expectedVersion: 1,
    title: '旧版本覆盖',
    body: '不应覆盖新稿。',
  });
  let result = await request(`/admin/announcements/${draft.id}/publish`, admin.accessToken, 201, 'POST', {
    expectedVersion: 2,
  });
  assert.ok(['SENDING', 'SENT'].includes(result.status));
  assert.equal(result.version, 3);
  assert.equal(result.recipientCount, activeUserCount);
  result = await waitForSent(draft.id, admin.accessToken);
  assert.equal(result.deliveredCount, activeUserCount);
  const repeat = await request(`/admin/announcements/${draft.id}/publish`, admin.accessToken, 201, 'POST', {
    expectedVersion: 3,
  });
  assert.equal(repeat.status, 'SENT');
  assert.equal(
    await db.notification.count({ where: { targetId: draft.id, targetType: 'ANNOUNCEMENT' } }),
    activeUserCount,
  );
  const notice = await request('/notifications', recipient.accessToken);
  const item = notice.items.find((message) => message.targetId === draft.id);
  assert.ok(item);
  assert.equal(item.title, '服务升级通知（更新）');
  const destination = await request(`/notifications/${item.id}/destination`, recipient.accessToken);
  assert.deepEqual(destination, { kind: 'ANNOUNCEMENT', title: item.title, body: '维护时间：周五凌晨。' });
  await request(`/notifications/${item.id}/read`, recipient.accessToken, 200, 'PATCH', {});
  result = await request(`/admin/announcements/${draft.id}`, admin.accessToken);
  assert.equal(result.status, 'SENT');
  const page = await request('/admin/announcements?limit=1', admin.accessToken);
  assert.equal(page.items.length, 1);
  await request('/admin/announcements?limit=100', admin.accessToken, 400);
  await request(`/admin/announcements/${draft.id}`, owner.accessToken, 403);

  console.log(
    JSON.stringify(
      {
        requests,
        passed: [
          'admin-only endpoints',
          'idempotent draft creation',
          'optimistic version conflict',
          'active recipient snapshot and notification delivery',
          'idempotent publication without duplicate messages',
          'recipient read and announcement detail resolution',
          'validated cursor page size',
        ],
        mode: 'Real loopback HTTP/PostgreSQL with disposable local fixture users; no external services',
      },
      null,
      2,
    ),
  );
} finally {
  await db.announcement.deleteMany({ where: { authorId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
