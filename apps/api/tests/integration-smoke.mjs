import assert from 'node:assert/strict';

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

const allowedOrigin = await fetch(`${baseUrl}/health`, { headers: { origin: 'http://localhost:5173' } });
assert.equal(allowedOrigin.headers.get('access-control-allow-origin'), 'http://localhost:5173');
const rejectedOrigin = await fetch(`${baseUrl}/health`, { headers: { origin: 'https://attacker.example' } });
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

const profileResult = await request('/body-profiles', {
  method: 'POST',
  headers: authorization,
  body: JSON.stringify({ name: 'Smoke Profile', heightCm: 165, weightKg: 52 }),
});
assert.equal(profileResult.response.status, 201);
const profileVersionId = profileResult.body.id;
assert.ok(profileVersionId);

const clothing = await request('/wardrobe/items', {
  method: 'POST',
  headers: authorization,
  body: JSON.stringify({ name: 'Smoke Top', category: 'TOP' }),
});
assert.equal(clothing.response.status, 201);

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

let job = createdJob.body;
for (let attempt = 0; attempt < 12 && !['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(job.status); attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const result = await request(`/generation-jobs/${job.id}`, { headers: authorization });
  assert.equal(result.response.status, 200);
  job = result.body;
}
assert.equal(job.status, 'SUCCEEDED');
assert.equal(job.outputs.length, 1);

console.log(JSON.stringify({ health: 'ok', login: 'ok', profile: 'ok', clothing: 'ok', generation: job.status, idempotency: 'ok' }));
