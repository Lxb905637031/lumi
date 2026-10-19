import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';

assert.notEqual(process.env.NODE_ENV, 'production');
const baseUrl = process.env.LUMI_API_URL ?? 'http://127.0.0.1:4300/api/v1';
for (const target of [baseUrl, process.env.DATABASE_URL]) {
  assert.ok(target, 'Local API and database are required');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(target).hostname), 'Local fixtures only');
}
const db = new PrismaClient();
const runId = randomUUID();
const users = [];
let requests = 0;
async function request(path, status, token, method = 'GET', body) {
  requests += 1;
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
async function session(name) {
  const auth = await request('/auth/wechat/login', 201, null, 'POST', { code: `local:results:${runId}:${name}` });
  users.push(auth.user.id);
  return { id: auth.user.id, token: auth.accessToken };
}
async function upload(token) {
  const bytes = await sharp({ create: { width: 24, height: 32, channels: 3, background: '#abc' } })
    .png()
    .toBuffer();
  const reservation = await request('/media/assets/uploads', 201, token, 'POST', {
    fileName: 'results.png',
    mimeType: 'image/png',
    byteSize: bytes.length,
    idempotencyKey: randomUUID(),
  });
  const form = new FormData();
  for (const [key, value] of Object.entries(reservation.upload.fields)) form.append(key, value);
  form.append('file', new Blob([bytes], { type: 'image/png' }), 'results.png');
  assert.equal(
    (await fetch(reservation.upload.url, { method: 'POST', body: form, signal: AbortSignal.timeout(15000) })).status,
    201,
  );
  return request(`/media/assets/${reservation.assetId}/complete`, 201, token, 'POST');
}
try {
  const owner = await session('owner');
  const outsider = await session('outsider');
  const profile = await request('/body-profiles', 201, owner.token, 'POST', { name: 'Result fixture' });
  const item = await request('/wardrobe/items', 201, owner.token, 'POST', { name: 'Result fixture', category: 'TOP' });
  let job = await request('/generation-jobs', 201, owner.token, 'POST', {
    profileVersionId: profile.id,
    clothingAssetId: item.id,
    idempotencyKey: randomUUID(),
  });
  for (let attempt = 0; attempt < 40 && job.status !== 'SUCCEEDED'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    job = await request(`/generation-jobs/${job.id}`, 200, owner.token);
  }
  assert.equal(job.status, 'SUCCEEDED');
  const output = job.outputs[0];
  const path = `/generation-jobs/${job.id}/outputs/${output.id}`;
  await request(path + '/selection', 401, null, 'PUT');
  for (const [suffix, method] of [
    ['/selection', 'PUT'],
    ['/saved', 'PUT'],
    ['/saved', 'DELETE'],
    ['', 'DELETE'],
  ])
    await request(path + suffix, 404, outsider.token, method);
  await request(path + '/saved', 409, owner.token, 'PUT');
  await request('/media/assets/' + output.assetId, 409, owner.token, 'DELETE');
  await request('/community/posts', 409, owner.token, 'POST', {
    title: 'Unconfirmed',
    idempotencyKey: randomUUID(),
    body: 'Fixture',
    imageAssetIds: [output.assetId],
  });
  const selected = await request(path + '/selection', 200, owner.token, 'PUT');
  const selectedAgain = await request(path + '/selection', 200, owner.token, 'PUT');
  assert.equal(selected.outputs[0].selectedAt, selectedAgain.outputs[0].selectedAt);
  const saved = await request(path + '/saved', 200, owner.token, 'PUT');
  const savedAgain = await request(path + '/saved', 200, owner.token, 'PUT');
  assert.ok(saved.outputs[0].savedAt);
  assert.equal(saved.outputs[0].savedAt, savedAgain.outputs[0].savedAt);
  assert.equal((await request(path + '/saved', 200, owner.token, 'DELETE')).outputs[0].savedAt, null);
  await request(path + '/saved', 200, owner.token, 'DELETE');
  // Additional candidates are explicit DB fixtures, not evidence of a multi-output AI provider.
  const s3Asset = await upload(owner.token);
  const candidate = await db.generationOutput.create({ data: { jobId: job.id, assetId: s3Asset.id } });
  const second = `/generation-jobs/${job.id}/outputs/${candidate.id}`;
  await Promise.all([
    request(path + '/selection', 200, owner.token, 'PUT'),
    request(second + '/selection', 200, owner.token, 'PUT'),
  ]);
  assert.equal(await db.generationOutput.count({ where: { jobId: job.id, selectedAt: { not: null } } }), 1);
  await request(second + '/selection', 200, owner.token, 'PUT');
  const post = await request('/community/posts', 201, owner.token, 'POST', {
    title: 'Selected fixture',
    idempotencyKey: randomUUID(),
    body: 'Fixture',
    imageAssetIds: [s3Asset.id],
    isAiGenerated: false,
  });
  assert.equal(post.isAiGenerated, true);
  await request(second, 409, owner.token, 'DELETE');
  assert.equal(
    (await db.generationOutput.findUniqueOrThrow({ where: { id: candidate.id } })).deletedAt,
    null,
    'Rejected deletion must roll back user state',
  );
  assert.equal((await db.mediaAsset.findUniqueOrThrow({ where: { id: s3Asset.id } })).status, 'READY');
  await request('/community/posts/' + post.id, 200, owner.token, 'DELETE');
  const balance = await request('/quota', 200, owner.token);
  const removed = await request(second, 200, owner.token, 'DELETE');
  assert.ok(!removed.outputs.some((row) => row.id === candidate.id));
  await request(second, 200, owner.token, 'DELETE');
  await request(second + '/selection', 404, owner.token, 'PUT');
  await request('/media/assets/' + s3Asset.id, 404, owner.token);
  assert.deepEqual(
    await request('/quota', 200, owner.token),
    balance,
    'Deleting a successful result never refunds consumed quota',
  );
  const media = await db.mediaAsset.findUniqueOrThrow({ where: { id: s3Asset.id } });
  const cleanup = await db.objectCleanup.findUnique({ where: { objectKey: media.objectKey } });
  assert.equal(media.status, 'DELETED');
  if (!cleanup)
    assert.equal(
      (await fetch(s3Asset.url, { signal: AbortSignal.timeout(5000) })).status,
      404,
      'Missing cleanup row means object is already physically deleted',
    );
  // Exercise publication-vs-deletion ordering across real HTTP transactions.
  await request(path + '/selection', 200, owner.token, 'PUT');
  const [publishRace, deleteRace] = await Promise.all([
    fetch(baseUrl + '/community/posts', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + owner.token, 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Race',
        body: 'Fixture',
        imageAssetIds: [output.assetId],
        idempotencyKey: randomUUID(),
      }),
      signal: AbortSignal.timeout(15000),
    }),
    fetch(baseUrl + path, {
      method: 'DELETE',
      headers: { authorization: 'Bearer ' + owner.token },
      signal: AbortSignal.timeout(15000),
    }),
  ]);
  requests += 2;
  const racePost = await publishRace.json();
  assert.ok(
    (publishRace.status === 201 && deleteRace.status === 409) ||
      (publishRace.status === 404 && deleteRace.status === 200),
    `Race must preserve references: ${publishRace.status}/${deleteRace.status}`,
  );
  if (publishRace.status === 201) {
    await request('/community/posts/' + racePost.id, 200, owner.token, 'DELETE');
    await request(path, 200, owner.token, 'DELETE');
  }
  assert.equal((await request(`/generation-jobs/${job.id}`, 200, owner.token)).outputs.length, 0);
  console.log(
    JSON.stringify(
      {
        requests,
        passed: [
          'owned, idempotent selection/save/delete',
          'single confirmed candidate under concurrency',
          'confirmation and server-enforced AI publication',
          'post reference and concurrent deletion protection',
          'private S3 deletion and unchanged consumed quota',
        ],
        mode: 'real HTTP/PostgreSQL/Redis/S3; local-svg + explicit second-candidate fixture; no real AI or WeChat acceptance',
      },
      null,
      2,
    ),
  );
} finally {
  for (const id of users) {
    const assets = await db.mediaAsset.findMany({
      where: { ownerId: id, storageDriver: 's3' },
      select: { objectKey: true },
    });
    for (const asset of assets)
      await db.objectCleanup.upsert({
        where: { objectKey: asset.objectKey },
        create: { objectKey: asset.objectKey, notBefore: new Date() },
        update: { notBefore: new Date() },
      });
    await db.generationJob.deleteMany({ where: { userId: id } });
    await db.user.delete({ where: { id } });
  }
  await db.$disconnect();
}
