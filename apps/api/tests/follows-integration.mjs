import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

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
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
async function login(label) {
  const session = await request('/auth/wechat/login', undefined, 201, 'POST', {
    code: `local:follows:${runId}:${label}`,
  });
  users.push(session.user.id);
  return session;
}
try {
  const alice = await login('alice');
  const bob = await login('bob');
  assert.equal((await request('/system/bootstrap')).features.follows, true);
  await request(`/community/users/${bob.user.id}/follow`, bob.accessToken, 409, 'PUT', { active: true });
  assert.deepEqual(
    await request(`/community/users/${bob.user.id}/follow`, alice.accessToken, 200, 'PUT', { active: true }),
    { following: true },
  );
  assert.deepEqual(
    await request(`/community/users/${bob.user.id}/follow`, alice.accessToken, 200, 'PUT', { active: true }),
    { following: true },
  );
  assert.deepEqual(await request(`/community/users/${bob.user.id}/follow-state`, alice.accessToken), {
    following: true,
  });
  const following = await request('/community/me/following?limit=1', alice.accessToken);
  assert.equal(following.items[0].id, bob.user.id);
  assert.equal(following.items[0].followed, true);
  const followers = await request('/community/me/followers?limit=1', bob.accessToken);
  assert.equal(followers.items[0].id, alice.user.id);
  assert.equal(followers.items[0].followed, false);
  await request(`/community/users/${bob.user.id}/follow`, bob.accessToken, 409, 'PUT', { active: true });
  assert.equal(await db.notification.count({ where: { userId: bob.user.id, type: 'FOLLOW' } }), 1);
  await request(`/community/users/${bob.user.id}/follow`, alice.accessToken, 200, 'PUT', { active: false });
  await request(`/community/users/${bob.user.id}/follow`, alice.accessToken, 200, 'PUT', { active: false });
  assert.deepEqual(await request(`/community/users/${bob.user.id}/follow-state`, alice.accessToken), {
    following: false,
  });
  await request(`/community/users/${alice.user.id}/follow`, alice.accessToken, 409, 'PUT', { active: true });
  await request('/community/users/not-a-user/follow', alice.accessToken, 404, 'PUT', { active: true });
  console.log(
    JSON.stringify(
      {
        requests,
        passed: [
          'self-follow rejection',
          'idempotent follow/unfollow',
          'owner-scoped state and cursor lists',
          'accurate follower follow-back state',
          'one follow notification under repeated writes',
          'unknown-user protection',
        ],
        mode: 'real local HTTP/PostgreSQL/Redis; no external social platform acceptance',
      },
      null,
      2,
    ),
  );
} finally {
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
