import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { normalizeEnvelope } from './api-envelope.mjs';

assert.notEqual(process.env.NODE_ENV, 'production');
const baseUrl = process.env.LUMI_API_URL ?? 'http://127.0.0.1:4300/api/v1';
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname));
const db = new PrismaClient();
const runId = randomUUID();
const users = [];
let requests = 0;

async function request(path, token, status = 200, method = 'GET', body) {
  requests += 1;
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  return normalizeEnvelope(data);
}

async function login(label) {
  const session = await request('/auth/wechat/login', undefined, 201, 'POST', {
    code: `local:privacy:${runId}:${label}`,
  });
  users.push(session.user.id);
  return session;
}

async function eventually(check, timeoutMs = 5_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('condition timed out');
}

try {
  const alice = await login('alice');
  const bob = await login('bob');

  assert.deepEqual(await request('/account/privacy/deletion', alice.accessToken), null);
  const badConfirmation = await request('/account/privacy/exports', alice.accessToken, 409, 'POST', {
    confirmation: 'nope',
  });
  assert.equal(badConfirmation.success, false);
  assert.equal(badConfirmation.code, 'CONFLICT');
  assert.match(badConfirmation.message, /确认导出/);
  assert.ok(badConfirmation.meta.requestId);

  const exportRequest = await request('/account/privacy/exports', alice.accessToken, 201, 'POST', {
    confirmation: 'EXPORT_MY_DATA',
  });
  assert.equal(exportRequest.status, 'REQUESTED');
  const ready = await eventually(async () => {
    const current = await request(`/account/privacy/exports/${exportRequest.id}`, alice.accessToken);
    return current.status === 'READY' ? current : null;
  });
  const exported = await request(`/account/privacy/exports/${exportRequest.id}/download`, alice.accessToken);
  assert.equal(exported.data.user.id, alice.user.id);
  await request(`/account/privacy/exports/${exportRequest.id}`, bob.accessToken, 404);
  assert.equal(ready.id, exportRequest.id);

  const deletion = await request('/account/privacy/deletion', alice.accessToken, 201, 'POST', {});
  assert.equal(deletion.status, 'REQUESTED');
  assert.deepEqual((await request('/account/privacy/deletion', alice.accessToken)).id, deletion.id);
  const cancelled = await request('/account/privacy/deletion', alice.accessToken, 200, 'DELETE');
  assert.equal(cancelled.status, 'CANCELLED');
  const requeued = await request('/account/privacy/deletion', alice.accessToken, 201, 'POST', {});
  assert.equal(requeued.status, 'REQUESTED');

  await db.accountDeletionRequest.update({
    where: { id: requeued.id },
    data: { scheduledFor: new Date(Date.now() - 1_000) },
  });
  const admin = await request('/auth/wechat/login', undefined, 201, 'POST', { code: 'local:admin-smoke' });
  const adminUser = await db.user.findUnique({ where: { id: admin.user.id }, select: { role: true } });
  assert.equal(adminUser?.role, 'ADMIN');
  await request('/admin/privacy/process', admin.accessToken, 201, 'POST', {});
  const completed = await db.accountDeletionRequest.findUnique({ where: { id: requeued.id } });
  assert.equal(completed?.status, 'COMPLETED');
  const deletedUser = await db.user.findUnique({ where: { id: alice.user.id } });
  assert.equal(deletedUser?.status, 'DELETED');
  assert.match(deletedUser?.wxOpenId ?? '', /^deleted:/);
  await request('/account/privacy/deletion', alice.accessToken, 401);
  assert.equal(await db.dataExportRequest.count({ where: { userId: alice.user.id, status: 'EXPIRED' } }), 1);
  assert.equal(await db.accountDeletionEvent.count({ where: { requestId: requeued.id } }), 5);
  console.log(
    JSON.stringify(
      {
        requests,
        passed: [
          'explicit export confirmation and async readiness',
          'owner-scoped export download',
          'deletion request/cancel/re-request state machine',
          'admin due-processing and auditable completion',
          'user anonymization, session invalidation and export expiry',
        ],
        mode: 'real local HTTP/PostgreSQL/Redis/S3 cleanup queue; no production data or paid service',
      },
      null,
      2,
    ),
  );
} finally {
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
