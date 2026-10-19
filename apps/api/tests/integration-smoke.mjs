import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const baseUrl = process.env.LUMI_API_URL ?? 'http://127.0.0.1:4300/api/v1';
const request = async (path, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await response.json();
  return { response, body };
};

const health = await request('/health');
assert.equal(health.response.status, 200);
assert.equal(health.body.service, 'lumi-api');

const bootstrap = await request('/system/bootstrap');
assert.equal(bootstrap.response.status, 200);
assert.equal(bootstrap.body.freeMode, true);

const allowedOrigin = await fetch(`${baseUrl}/health`, {
  headers: { origin: 'http://localhost:5173' },
});
assert.equal(allowedOrigin.headers.get('access-control-allow-origin'), 'http://localhost:5173');
const rejectedOrigin = await fetch(`${baseUrl}/health`, {
  headers: { origin: 'https://attacker.example' },
});
assert.equal(rejectedOrigin.headers.get('access-control-allow-origin'), null);

const login = await request('/auth/wechat/login', {
  method: 'POST',
  body: JSON.stringify({ code: `local:smoke-${Date.now()}` }),
});
assert.equal(login.response.status, 201);
assert.ok(login.body.accessToken);
assert.equal(login.body.freeMode, true);
const authorization = { authorization: `Bearer ${login.body.accessToken}` };

const unauthorized = await request('/body-profiles');
assert.equal(unauthorized.response.status, 401);

const invalidPagination = await request('/body-profiles?limit=100', {
  headers: authorization,
});
assert.equal(invalidPagination.response.status, 400);
const invalidCursor = await request('/body-profiles?cursor=not-a-valid-cursor', { headers: authorization });
assert.equal(invalidCursor.response.status, 400);

const profileResult = await request('/body-profiles', {
  method: 'POST',
  headers: authorization,
  body: JSON.stringify({ name: 'Smoke Profile', heightCm: 165, weightKg: 52 }),
});
assert.equal(profileResult.response.status, 201);
const profileVersionId = profileResult.body.id;
assert.ok(profileVersionId);
const profilesPage = await request('/body-profiles?limit=5', {
  headers: authorization,
});
assert.equal(profilesPage.response.status, 200);
assert.ok(Array.isArray(profilesPage.body.items));
assert.equal(profilesPage.body.items.length, 1);
assert.equal(profilesPage.body.nextCursor, null);

for (let index = 0; index < 3; index += 1) {
  await request('/body-profiles', {
    method: 'POST',
    headers: authorization,
    body: JSON.stringify({ name: `Pagination Profile ${index}` }),
  });
}
const firstProfilePage = await request('/body-profiles?limit=2', {
  headers: authorization,
});
assert.equal(firstProfilePage.body.items.length, 2);
assert.ok(firstProfilePage.body.nextCursor);
const secondProfilePage = await request(
  `/body-profiles?limit=2&cursor=${encodeURIComponent(firstProfilePage.body.nextCursor)}`,
  { headers: authorization },
);
assert.ok(secondProfilePage.body.items.length > 0);
assert.equal(
  firstProfilePage.body.items.some((item) => item.id === secondProfilePage.body.items[0].id),
  false,
);

const clothing = await request('/wardrobe/items', {
  method: 'POST',
  headers: authorization,
  body: JSON.stringify({ name: 'Smoke Top', category: 'TOP' }),
});
assert.equal(clothing.response.status, 201);
const clothingPage = await request('/wardrobe/items?limit=5', {
  headers: authorization,
});
assert.equal(clothingPage.response.status, 200);
assert.equal(clothingPage.body.items.length, 1);

const prisma = new PrismaClient();
const moderationPost = await prisma.post.create({
  data: {
    authorId: login.body.user.id,
    title: `Smoke moderation ${Date.now()}`,
    body: 'A moderation queue integration fixture created by the smoke test.',
  },
});
await prisma.$disconnect();

const forbiddenModeration = await request('/admin/moderation/posts', {
  headers: authorization,
});
assert.equal(forbiddenModeration.response.status, 403);

const adminLogin = await request('/auth/wechat/login', {
  method: 'POST',
  body: JSON.stringify({ code: 'local:admin-smoke' }),
});
assert.equal(adminLogin.response.status, 201);
assert.equal(adminLogin.body.user.role, 'ADMIN');
const adminAuthorization = { authorization: `Bearer ${adminLogin.body.accessToken}` };
const moderationPage = await request('/admin/moderation/posts?limit=5', {
  headers: adminAuthorization,
});
assert.equal(moderationPage.response.status, 200);
assert.ok(moderationPage.body.items.some((item) => item.id === moderationPost.id));

const moderationUpdate = await request(`/admin/moderation/posts/${moderationPost.id}/status`, {
  method: 'PATCH',
  headers: adminAuthorization,
  body: JSON.stringify({ status: 'APPROVED', reason: 'Smoke test approval' }),
});
assert.equal(moderationUpdate.response.status, 200);
assert.equal(moderationUpdate.body.status, 'APPROVED');
const repeatedModerationUpdate = await request(`/admin/moderation/posts/${moderationPost.id}/status`, {
  method: 'PATCH',
  headers: adminAuthorization,
  body: JSON.stringify({ status: 'APPROVED' }),
});
assert.equal(repeatedModerationUpdate.response.status, 200);
assert.equal(repeatedModerationUpdate.body.status, 'APPROVED');

const jobInput = {
  profileVersionId,
  clothingAssetId: clothing.body.id,
  idempotencyKey: `smoke-${Date.now()}-key`,
};
const createdJob = await request('/generation-jobs', {
  method: 'POST',
  headers: authorization,
  body: JSON.stringify(jobInput),
});
assert.equal(createdJob.response.status, 201);
const duplicateJob = await request('/generation-jobs', {
  method: 'POST',
  headers: authorization,
  body: JSON.stringify(jobInput),
});
assert.equal(duplicateJob.response.status, 201);
assert.equal(duplicateJob.body.id, createdJob.body.id);
const jobsPage = await request('/generation-jobs?limit=5', {
  headers: authorization,
});
assert.equal(jobsPage.response.status, 200);
assert.equal(jobsPage.body.items.length, 1);

let job = createdJob.body;
for (let attempt = 0; attempt < 12 && !['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(job.status); attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const result = await request(`/generation-jobs/${job.id}`, {
    headers: authorization,
  });
  assert.equal(result.response.status, 200);
  job = result.body;
}
assert.equal(job.status, 'SUCCEEDED');
assert.equal(job.outputs.length, 1);

console.log(
  JSON.stringify({
    health: 'ok',
    login: 'ok',
    profile: 'ok',
    clothing: 'ok',
    generation: job.status,
    idempotency: 'ok',
    moderation: 'ok',
  }),
);
