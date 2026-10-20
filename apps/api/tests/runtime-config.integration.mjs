import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { normalizeEnvelope } from './api-envelope.mjs';
import { databaseTarget } from '../scripts/migration-tools.mjs';

assert.notEqual(process.env.NODE_ENV, 'production');
databaseTarget(process.env.DATABASE_URL);
const baseUrl = process.env.LUMI_API_URL ?? 'http://127.0.0.1:4300/api/v1';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname));
const db = new PrismaClient();
const runId = randomUUID();
const userIds = [];
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

try {
  const session = await request('/auth/wechat/login', undefined, 201, 'POST', {
    code: `local:runtime-config:${runId}`,
  });
  const userId = session.user.id;
  userIds.push(userId);
  await db.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
  const admin = await request('/auth/wechat/login', undefined, 201, 'POST', {
    code: `local:runtime-config-admin:${runId}`,
  });
  const adminId = admin.user.id;
  userIds.push(adminId);
  await db.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });
  const normal = await request('/auth/wechat/login', undefined, 201, 'POST', {
    code: `local:runtime-config-normal:${runId}`,
  });
  userIds.push(normal.user.id);
  await request('/admin/runtime-configs', session.accessToken, 200);
  const created = await request('/admin/runtime-configs', admin.accessToken, 200, 'PATCH', {
    key: 'generation.model',
    value: { enabled: true, provider: 'self-hosted', modelId: 'free-model-v1' },
    reason: '启用本地验收模型配置',
  });
  assert.equal(created.version, 1);
  const next = await request('/admin/runtime-configs', admin.accessToken, 200, 'PATCH', {
    key: 'generation.model',
    value: { enabled: false, provider: 'disabled', modelId: 'free-model-v1' },
    reason: '临时关闭模型',
  });
  assert.equal(next.version, 2);
  const history = await request('/admin/runtime-configs/generation.model/history', admin.accessToken);
  assert.equal(history.items.length, 2);
  const rolledBack = await request('/admin/runtime-configs/rollback', admin.accessToken, 201, 'POST', {
    key: 'generation.model',
    expectedCurrentId: next.id,
    targetId: created.id,
    reason: '回滚验证',
  });
  assert.equal(rolledBack.version, 3);
  assert.equal(rolledBack.value.enabled, true);
  await request('/admin/runtime-configs/rollback', admin.accessToken, 409, 'POST', {
    key: 'generation.model',
    expectedCurrentId: next.id,
    targetId: created.id,
    reason: '过期版本不得覆盖',
  });
  await request('/admin/runtime-configs', normal.accessToken, 403, 'PATCH', {
    key: 'generation.model',
    value: { enabled: true, provider: 'local-svg', modelId: 'x' },
    reason: '越权写入',
  });
  console.log(
    JSON.stringify(
      {
        requests,
        passed: ['admin-only versioned configs', 'schema validation', 'optimistic rollback conflict'],
        mode: 'Real loopback HTTP/PostgreSQL with disposable local users; no external services',
      },
      null,
      2,
    ),
  );
} finally {
  if (userIds.length) {
    await db.runtimeConfig.deleteMany({ where: { actorId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await db.$disconnect();
}
