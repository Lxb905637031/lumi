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

async function login(label) {
  const session = await request('/auth/wechat/login', undefined, 201, 'POST', {
    code: `local:user-moderation:${runId}:${label}`,
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
  const target = await login('target');
  const normal = await login('normal');
  const adminFixture = await login('admin');
  await db.user.update({ where: { id: adminFixture.user.id }, data: { role: 'ADMIN' } });
  const username = `user-moderation-${runId}`;
  const password = `local-${runId}-admin`;
  await db.adminCredential.create({
    data: { userId: adminFixture.user.id, username, passwordHash: await hashPassword(password) },
  });
  const admin = await request('/auth/admin/login', undefined, 201, 'POST', { username, password });

  await request('/admin/users', normal.accessToken, 403);
  let page = await request('/admin/users?status=ACTIVE&limit=50', admin.accessToken);
  const listed = page.items.find((item) => item.id === target.user.id);
  assert.ok(listed);
  assert.equal(listed.status, 'ACTIVE');
  assert.equal(typeof listed.postCount, 'number');
  const roleFiltered = await request(
    `/admin/users?status=ACTIVE&role=ADMIN&search=${admin.user.id}`,
    admin.accessToken,
  );
  assert.equal(roleFiltered.items.length, 1);
  assert.equal(roleFiltered.items[0].role, 'ADMIN');
  await request('/admin/users?limit=100', admin.accessToken, 400);

  const suspended = await request(`/admin/users/${target.user.id}/status`, admin.accessToken, 200, 'PATCH', {
    status: 'SUSPENDED',
    expectedUpdatedAt: listed.updatedAt,
    reason: '违反社区规范',
  });
  assert.equal(suspended.status, 'SUSPENDED');
  const suspensionHistory = await request(`/admin/users/${target.user.id}/actions?limit=20`, admin.accessToken);
  assert.deepEqual(Object.keys(suspensionHistory.items[0]).sort(), [
    'actorId',
    'createdAt',
    'fromRole',
    'fromStatus',
    'id',
    'reason',
    'toRole',
    'toStatus',
  ]);
  assert.equal(suspensionHistory.items.length, 1);
  assert.equal(suspensionHistory.items[0].toStatus, 'SUSPENDED');
  await request(`/admin/users/${target.user.id}/actions?limit=0`, admin.accessToken, 400);
  await request('/body-profiles', target.accessToken, 401);
  await request('/auth/wechat/login', undefined, 401, 'POST', {
    code: `local:user-moderation:${runId}:target`,
  });
  await request(`/admin/users/${target.user.id}/status`, admin.accessToken, 409, 'PATCH', {
    status: 'ACTIVE',
    expectedUpdatedAt: listed.updatedAt,
    reason: '旧版本解封',
  });

  page = await request('/admin/users?status=SUSPENDED&limit=50', admin.accessToken);
  const suspendedRow = page.items.find((item) => item.id === target.user.id);
  assert.ok(suspendedRow);
  const restored = await request(`/admin/users/${target.user.id}/status`, admin.accessToken, 200, 'PATCH', {
    status: 'ACTIVE',
    expectedUpdatedAt: suspendedRow.updatedAt,
    reason: '复核后解封',
  });
  assert.equal(restored.status, 'ACTIVE');
  const roleChanged = await request(`/admin/users/${target.user.id}/status`, admin.accessToken, 200, 'PATCH', {
    role: 'MODERATOR',
    expectedUpdatedAt: restored.updatedAt,
    reason: '授予内容审核职责',
  });
  assert.equal(roleChanged.role, 'MODERATOR');
  await request(`/admin/users/${target.user.id}/status`, admin.accessToken, 200, 'PATCH', {
    role: 'USER',
    expectedUpdatedAt: roleChanged.updatedAt,
    reason: '职责调整',
  });
  await request(`/admin/users/${admin.user.id}/status`, admin.accessToken, 403, 'PATCH', {
    status: 'SUSPENDED',
    expectedUpdatedAt: (await request('/admin/users?search=' + admin.user.id, admin.accessToken)).items[0].updatedAt,
    reason: '不应封禁自己',
  });
  assert.equal(await db.userModerationAction.count({ where: { userId: target.user.id } }), 4);

  console.log(
    JSON.stringify(
      {
        requests,
        passed: [
          'admin-only user list and mutations',
          'cursor limit validation and search',
          'suspension revokes sessions and blocks login',
          'optimistic timestamp conflict',
          'unban and role audit transitions',
          'self-protection for administrator account',
        ],
        mode: 'Real loopback HTTP/PostgreSQL with disposable local fixture users; no external services',
      },
      null,
      2,
    ),
  );
} finally {
  await db.userModerationAction.deleteMany({ where: { actorId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
