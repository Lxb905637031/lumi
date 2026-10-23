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

  const activePost = await db.post.create({
    data: {
      authorId: target.user.id,
      title: 'mute integration fixture',
      body: 'private test post',
      imageAssetIds: [],
      moderationStatus: 'APPROVED',
    },
  });

  await request('/admin/users', normal.accessToken, 403);
  let page = await request('/admin/users?status=ACTIVE&limit=50', admin.accessToken);
  const listed = page.items.find((item) => item.id === target.user.id);
  assert.ok(listed);
  assert.equal(listed.status, 'ACTIVE');
  assert.equal(typeof listed.postCount, 'number');
  await request(`/admin/users/${target.user.id}/mute`, normal.accessToken, 403, 'POST', {
    expectedUpdatedAt: listed.updatedAt,
    reason: '权限校验',
  });
  await request(`/admin/users/${target.user.id}/mute`, admin.accessToken, 201, 'POST', {
    expectedUpdatedAt: listed.updatedAt,
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    reason: '测试禁言',
  });
  const mutedPage = await request(`/admin/users?search=${target.user.id}`, admin.accessToken);
  const mutedUser = mutedPage.items[0];
  assert.ok(mutedUser.activeMute);
  assert.equal(mutedUser.activeMute.reason, '测试禁言');
  await request(`/admin/users/${target.user.id}/unmute`, admin.accessToken, 409, 'POST', {
    expectedUpdatedAt: listed.updatedAt,
    reason: '过期版本不应写入',
  });
  await request('/community/posts', target.accessToken, 403, 'POST', {
    idempotencyKey: randomUUID(),
    title: 'blocked post',
    body: 'blocked while muted',
    imageAssetIds: ['missing-asset'],
  });
  await request(`/community/posts/${activePost.id}/comments`, target.accessToken, 403, 'POST', {
    body: 'blocked comment',
  });
  const muteHistory = await request(`/admin/users/${target.user.id}/mutes?limit=20`, admin.accessToken);
  assert.deepEqual(Object.keys(muteHistory.items[0]).sort(), [
    'actorId',
    'createdAt',
    'endsAt',
    'id',
    'reason',
    'revokedAt',
    'revokedById',
    'revokedReason',
    'startsAt',
  ]);
  assert.equal(muteHistory.items[0].actorId, admin.user.id);
  await db.userMute.update({ where: { id: muteHistory.items[0].id }, data: { endsAt: new Date(Date.now() - 1000) } });
  await request(`/community/posts/${activePost.id}/comments`, target.accessToken, 201, 'POST', {
    body: 'available after expiry',
  });
  const renewed = await request(`/admin/users/${target.user.id}/mute`, admin.accessToken, 201, 'POST', {
    expectedUpdatedAt: mutedUser.updatedAt,
    reason: '撤销闭环测试',
  });
  await request(`/admin/users/${target.user.id}/unmute`, admin.accessToken, 201, 'POST', {
    expectedUpdatedAt: renewed.updatedAt,
    reason: '复核通过',
  });
  const unmutedPage = await request(`/admin/users?search=${target.user.id}`, admin.accessToken);
  assert.equal(unmutedPage.items[0].activeMute, null);
  assert.equal((await db.userMute.findMany({ where: { userId: target.user.id, revokedAt: { not: null } } })).length, 1);
  assert.equal(
    (await db.userMute.findFirstOrThrow({ where: { userId: target.user.id, revokedAt: { not: null } } })).revokedReason,
    '复核通过',
  );
  const roleFiltered = await request(
    `/admin/users?status=ACTIVE&role=ADMIN&search=${admin.user.id}`,
    admin.accessToken,
  );
  assert.equal(roleFiltered.items.length, 1);
  assert.equal(roleFiltered.items[0].role, 'ADMIN');
  await request('/admin/users?limit=100', admin.accessToken, 400);

  const suspended = await request(`/admin/users/${target.user.id}/status`, admin.accessToken, 200, 'PATCH', {
    status: 'SUSPENDED',
    expectedUpdatedAt: unmutedPage.items[0].updatedAt,
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
  const moderator = await login('target');
  await request('/admin/moderation/posts?limit=1', moderator.accessToken);
  await request('/admin/moderation/comments?limit=1', moderator.accessToken);
  await request('/admin/moderation/media?limit=1', moderator.accessToken);
  await request('/admin/moderation/reports?limit=1', moderator.accessToken);
  await request('/admin/overview', moderator.accessToken);
  await request('/admin/audit?limit=1', moderator.accessToken, 403);
  await request('/admin/users?limit=1', moderator.accessToken, 403);
  await request('/admin/runtime-configs', moderator.accessToken, 403);
  await request('/admin/announcements?limit=1', moderator.accessToken, 403);
  await request('/admin/challenges?limit=1', moderator.accessToken, 403);
  await request('/admin/privacy/process', moderator.accessToken, 403, 'POST');
  await request(`/admin/moderation/posts/${activePost.id}/status`, moderator.accessToken, 200, 'PATCH', {
    status: 'REMOVED',
    reason: '权限矩阵写操作验证',
  });
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
          'admin-only timed/permanent mute, community write rejection, expiry and audited revoke',
          'moderator route permissions allow moderation/operations but deny audit and sensitive administration',
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
