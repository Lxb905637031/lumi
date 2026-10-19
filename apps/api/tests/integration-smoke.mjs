import assert from 'node:assert/strict';
import { randomBytes, randomUUID, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';

const baseUrl = process.env.LUMI_API_URL ?? 'http://127.0.0.1:4300/api/v1';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname), 'Smoke tests are local-only');
const prisma = new PrismaClient();
const fixtureUsers = new Set();
const runId = randomUUID();
const passed = [];
let requestCount = 0;

async function request(path, expectedStatus = 200, init = {}) {
  requestCount += 1;
  const response = await fetch(baseUrl + path, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    headers: { ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(init.headers ?? {}) },
  });
  const body = await response.json();
  assert.equal(response.status, expectedStatus, path + ': ' + JSON.stringify(body));
  return body;
}

function write(method, headers, data = {}) {
  return { method, headers, body: JSON.stringify(data) };
}

function authorization(session) {
  return { authorization: 'Bearer ' + session.accessToken };
}

async function login(label) {
  const session = await request('/auth/wechat/login', 201, write('POST', {}, { code: 'local:' + runId + '-' + label }));
  fixtureUsers.add(session.user.id);
  return session;
}

async function createImage(input, uploadMode, headers, expectedStatus = 201) {
  if (uploadMode !== 'signed-post') return request('/media/assets', expectedStatus, write('POST', headers, input));
  const bytes = Buffer.from(input.base64, 'base64');
  const reservation = await request(
    '/media/assets/uploads',
    201,
    write('POST', headers, {
      fileName: input.fileName,
      mimeType: input.mimeType,
      byteSize: bytes.length,
      idempotencyKey: randomUUID(),
    }),
  );
  const form = new FormData();
  for (const [key, value] of Object.entries(reservation.upload.fields)) form.append(key, value);
  form.append('file', new Blob([bytes], { type: input.mimeType }), input.fileName);
  assert.equal(
    (await fetch(reservation.upload.url, { method: 'POST', body: form, signal: AbortSignal.timeout(15_000) })).status,
    201,
  );
  return request('/media/assets/' + reservation.assetId + '/complete', expectedStatus, { method: 'POST', headers });
}

async function waitForJob(id, headers) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const job = await request('/generation-jobs/' + id, 200, { headers });
    if (['SUCCEEDED', 'FAILED', 'DEAD_LETTER', 'CANCELLED'].includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.fail('Generation did not reach a terminal state: ' + id);
}

try {
  const health = await request('/health');
  assert.equal(health.service, 'lumi-api');
  const bootstrap = await request('/system/bootstrap');
  assert.equal(bootstrap.freeMode, true, 'Never run fixture mutations against a production API');
  const allowed = await fetch(baseUrl + '/health', { headers: { origin: 'http://localhost:5173' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const rejected = await fetch(baseUrl + '/health', { headers: { origin: 'https://attacker.example' } });
  assert.equal(rejected.headers.get('access-control-allow-origin'), null);
  passed.push('health and CORS allowlist');

  const owner = await login('owner');
  const outsider = await login('outsider');
  const ownerAuth = authorization(owner);
  const outsiderAuth = authorization(outsider);
  await request('/body-profiles', 401);
  await request('/body-profiles?limit=100', 400, { headers: ownerAuth });
  await request('/body-profiles?cursor=invalid', 400, { headers: ownerAuth });
  await request('/admin/overview', 403, { headers: ownerAuth });
  await request('/admin/moderation/comments', 403, { headers: ownerAuth });

  const password = randomBytes(24).toString('hex');
  const salt = randomBytes(16).toString('hex');
  const derived = await promisify(scrypt)(password, salt, 64);
  const username = 'smoke-' + runId;
  const admin = await prisma.user.create({
    data: {
      wxOpenId: 'fixture-admin:' + runId,
      role: 'ADMIN',
      adminCredential: { create: { username, passwordHash: 'scrypt$' + salt + '$' + derived.toString('hex') } },
    },
  });
  fixtureUsers.add(admin.id);
  await request('/auth/admin/login', 401, write('POST', {}, { username, password: 'incorrect-password' }));
  const adminSession = await request('/auth/admin/login', 201, write('POST', {}, { username, password }));
  const adminAuth = authorization(adminSession);
  assert.equal(adminSession.user.role, 'ADMIN');
  const overview = await request('/admin/overview', 200, { headers: adminAuth });
  for (const metric of ['pendingPosts', 'generationToday', 'failedGenerations', 'communityPosts', 'openReports']) {
    assert.equal(typeof overview[metric], 'number');
  }
  passed.push('password admin login, RBAC and persisted overview');

  const png = {
    fileName: 'smoke.png',
    mimeType: 'image/png',
    base64: (
      await sharp({ create: { width: 32, height: 48, channels: 3, background: '#987' } })
        .png()
        .toBuffer()
    ).toString('base64'),
  };
  const image = await createImage(png, bootstrap.media?.uploadMode, ownerAuth);
  assert.equal(image.visibility, 'PRIVATE');
  await request('/media/assets/' + image.id, 404, { headers: outsiderAuth });
  await request('/media/assets/' + image.id, 404, { method: 'DELETE', headers: outsiderAuth });
  await createImage(
    { ...png, base64: Buffer.from('not an image').toString('base64') },
    bootstrap.media?.uploadMode,
    ownerAuth,
    400,
  );
  await request('/body-profiles', 404, write('POST', outsiderAuth, { name: 'Foreign image', sourceAssetId: image.id }));
  await request(
    '/wardrobe/items',
    404,
    write('POST', outsiderAuth, { name: 'Foreign image', category: 'TOP', assetId: image.id }),
  );
  passed.push('development media ownership and invalid image rejection');

  const profileInput = {
    name: 'Smoke Profile',
    heightCm: 165,
    weightKg: 52,
    shoulderCm: 39,
    bustCm: 88,
    waistCm: 70,
    hipCm: 94,
    sourceAssetId: image.id,
  };
  const profileVersion = await request('/body-profiles', 201, write('POST', ownerAuth, profileInput));
  const profileId = profileVersion.profileId;
  assert.equal(profileVersion.measurements.shoulderCm, 39);
  await request('/body-profiles/' + profileId, 404, { headers: outsiderAuth });
  const updatedProfile = await request(
    '/body-profiles/' + profileId,
    200,
    write('PATCH', ownerAuth, {
      ...profileInput,
      expectedVersion: 1,
      heightCm: 166,
    }),
  );
  assert.equal(updatedProfile.version, 2);
  await request('/body-profiles/' + profileId, 409, write('PATCH', ownerAuth, { ...profileInput, expectedVersion: 1 }));
  const profileAfterConflict = await request('/body-profiles/' + profileId, 200, { headers: ownerAuth });
  assert.equal(profileAfterConflict.activeVersion, 2);

  for (let index = 0; index < 3; index += 1) {
    await request('/body-profiles', 201, write('POST', ownerAuth, { name: 'Pagination ' + index }));
  }
  const firstPage = await request('/body-profiles?limit=2', 200, { headers: ownerAuth });
  const secondPage = await request('/body-profiles?limit=2&cursor=' + encodeURIComponent(firstPage.nextCursor), 200, {
    headers: ownerAuth,
  });
  assert.equal(firstPage.items.length, 2);
  assert.equal(secondPage.items.length, 2);
  assert.equal(new Set([...firstPage.items, ...secondPage.items].map((item) => item.id)).size, 4);
  const clothing = await request(
    '/wardrobe/items',
    201,
    write('POST', ownerAuth, { name: 'Smoke Top', category: 'TOP', assetId: image.id }),
  );
  const updatedClothing = await request(
    '/wardrobe/items/' + clothing.id,
    200,
    write('PATCH', ownerAuth, {
      name: 'Updated Top',
      category: 'TOP',
      color: 'white',
      style: 'minimal',
    }),
  );
  assert.equal(updatedClothing.color, 'white');
  await request('/wardrobe/items/' + clothing.id, 404, { headers: outsiderAuth });
  await request(
    '/wardrobe/items/' + clothing.id,
    404,
    write('PATCH', outsiderAuth, { name: 'Stolen', category: 'TOP' }),
  );
  passed.push('six measurements, version conflicts, wardrobe edits and cursor pagination');

  const jobInput = {
    profileVersionId: updatedProfile.id,
    clothingAssetId: clothing.id,
    idempotencyKey: runId + '-job',
  };
  await request('/quota', 401);
  await request('/quota/ledger', 401);
  const scopedQuota = await request('/quota?userId=' + owner.user.id, 200, { headers: outsiderAuth });
  assert.equal(scopedQuota.consumed, 0);
  await request('/quota', 404, write('POST', ownerAuth, { available: 1000 }));
  const initialQuota = await request('/quota', 200, { headers: ownerAuth });
  assert.equal(initialQuota.granted, 5, 'Smoke fixture assumes the documented development grant');
  assert.equal(initialQuota.available, 5);
  await request('/quota/ledger?limit=100', 400, { headers: ownerAuth });
  await request('/quota/ledger?cursor=invalid', 400, { headers: ownerAuth });
  await request(
    '/generation-jobs',
    404,
    write('POST', outsiderAuth, { ...jobInput, idempotencyKey: runId + '-foreign' }),
  );
  const createdJob = await request('/generation-jobs', 201, write('POST', ownerAuth, jobInput));
  const duplicateJob = await request('/generation-jobs', 201, write('POST', ownerAuth, jobInput));
  assert.equal(duplicateJob.id, createdJob.id);
  await request('/generation-jobs', 409, write('POST', ownerAuth, { ...jobInput, clothingAssetId: 'different-input' }));
  await request('/generation-jobs/' + createdJob.id, 404, { headers: outsiderAuth });
  const job = await waitForJob(createdJob.id, ownerAuth);
  assert.equal(job.status, 'SUCCEEDED');
  assert.equal(job.provider, 'local-svg');
  assert.equal(job.outputs.length, 1);
  assert.equal(job.outputs[0].visibility, 'PRIVATE');
  assert.match(job.outputs[0].previewData, /^data:image\/svg\+xml;base64,/);
  assert.deepEqual(await request('/quota', 200, { headers: ownerAuth }), {
    ...initialQuota,
    available: 4,
    consumed: 1,
  });
  const ledgerFirst = await request('/quota/ledger?limit=1', 200, { headers: ownerAuth });
  assert.equal(ledgerFirst.items[0].type, 'COMMIT');
  const ledgerNext = await request('/quota/ledger?limit=1&cursor=' + encodeURIComponent(ledgerFirst.nextCursor), 200, {
    headers: ownerAuth,
  });
  assert.equal(ledgerNext.items[0].type, 'RESERVE');
  assert.notEqual(ledgerFirst.items[0].id, ledgerNext.items[0].id);
  const outsiderLedger = await request('/quota/ledger?limit=50', 200, { headers: outsiderAuth });
  assert.ok(outsiderLedger.items.every((entry) => entry.jobId !== job.id));
  assert.equal(JSON.stringify(ledgerFirst).includes('eventKey'), false);
  const recovery = await prisma.generationJob.create({
    data: {
      userId: owner.user.id,
      profileVersionId: updatedProfile.id,
      clothingAssetId: clothing.id,
      idempotencyKey: runId + '-retry',
      provider: 'local-svg',
      status: 'DEAD_LETTER',
    },
  });
  await request('/generation-jobs/' + recovery.id + '/retry', 201, write('POST', ownerAuth));
  assert.equal((await waitForJob(recovery.id, ownerAuth)).status, 'SUCCEEDED');
  assert.deepEqual(await request('/quota', 200, { headers: ownerAuth }), {
    ...initialQuota,
    available: 3,
    consumed: 2,
  });
  const cancellable = await prisma.generationJob.create({
    data: {
      userId: owner.user.id,
      profileVersionId: updatedProfile.id,
      clothingAssetId: clothing.id,
      idempotencyKey: runId + '-cancel',
      provider: 'local-svg',
      status: 'QUEUED',
    },
  });
  assert.equal(
    (await request('/generation-jobs/' + cancellable.id + '/cancel', 201, write('POST', ownerAuth))).status,
    'CANCELLED',
  );
  assert.equal(
    (await request('/generation-jobs/' + cancellable.id + '/cancel', 201, write('POST', ownerAuth))).status,
    'CANCELLED',
  );
  passed.push('durable development generation, idempotency, recovery and cancellation');

  const quotaJobs = await Promise.all(
    Array.from({ length: 3 }, (_, index) =>
      request(
        '/generation-jobs',
        201,
        write('POST', ownerAuth, { ...jobInput, idempotencyKey: runId + '-quota-' + index }),
      ),
    ),
  );
  const exhausted = await request(
    '/generation-jobs',
    409,
    write('POST', ownerAuth, { ...jobInput, idempotencyKey: runId + '-exhausted' }),
  );
  assert.equal(exhausted.code, 'FREE_QUOTA_EXHAUSTED');
  for (const pending of quotaJobs) assert.equal((await waitForJob(pending.id, ownerAuth)).status, 'SUCCEEDED');
  assert.deepEqual(await request('/quota', 200, { headers: ownerAuth }), {
    ...initialQuota,
    available: 0,
    consumed: 5,
  });
  assert.equal(
    await prisma.generationJob.count({ where: { userId: owner.user.id, idempotencyKey: runId + '-exhausted' } }),
    0,
  );
  passed.push('real HTTP quota ownership, pagination, successful consumption and concurrent budget exhaustion');

  const postInput = {
    idempotencyKey: randomUUID(),
    title: 'Smoke community post',
    body: 'HTTP acceptance fixture',
    imageAssetIds: [image.id],
    topic: runId,
    isAiGenerated: true,
  };
  await request(
    '/community/posts',
    400,
    write('POST', ownerAuth, { title: 'No images', body: 'Rejected', idempotencyKey: randomUUID() }),
  );
  const post = await request('/community/posts', 201, write('POST', ownerAuth, postInput));
  await request('/community/posts/' + post.id, 404);
  const ownPosts = await request('/community/me/posts?limit=5', 200, { headers: ownerAuth });
  assert.ok(ownPosts.items.some((item) => item.id === post.id && item.moderationStatus === 'PENDING'));
  const feedBefore = await request('/community/posts?topic=' + runId);
  assert.equal(feedBefore.items.length, 0);
  await request(
    '/admin/moderation/posts/' + post.id + '/status',
    403,
    write('PATCH', ownerAuth, { status: 'APPROVED' }),
  );
  await request(
    '/admin/moderation/posts/' + post.id + '/status',
    200,
    write('PATCH', adminAuth, { status: 'APPROVED', reason: 'Acceptance approval' }),
  );
  await request(
    '/admin/moderation/posts/' + post.id + '/status',
    200,
    write('PATCH', adminAuth, { status: 'APPROVED' }),
  );
  assert.equal(await prisma.moderationAction.count({ where: { postId: post.id } }), 1);
  const feed = await request('/community/posts?topic=' + runId + '&limit=1');
  assert.equal(feed.items.length, 1);
  assert.equal(feed.items[0].imagePreviews.length, 1);
  assert.equal(JSON.stringify(feed).includes(owner.user.openId), false, 'Public responses must not leak WeChat OpenID');
  const likes = await Promise.all(
    Array.from({ length: 3 }, () =>
      request('/community/posts/' + post.id + '/like', 201, write('POST', ownerAuth, { active: true })),
    ),
  );
  assert.ok(likes.every((result) => result.liked === true));
  assert.equal((await request('/community/posts/' + post.id)).likeCount, 1);
  await request('/community/posts/' + post.id + '/bookmark', 201, write('POST', ownerAuth, { active: true }));
  await request('/community/posts/' + post.id + '/bookmark', 201, write('POST', ownerAuth, { active: true }));
  const bookmarks = await request('/community/me/bookmarks?limit=5', 200, { headers: ownerAuth });
  assert.ok(bookmarks.items.some((item) => item.id === post.id));
  assert.deepEqual(await request('/community/posts/' + post.id + '/state', 200, { headers: ownerAuth }), {
    liked: true,
    bookmarked: true,
  });
  passed.push('publish, pending isolation, approval audit, feed, idempotent likes and bookmarks');

  const comment = await request(
    '/community/posts/' + post.id + '/comments',
    201,
    write('POST', ownerAuth, { body: 'Pending comment' }),
  );
  const commentsBefore = await request('/community/posts/' + post.id + '/comments?limit=5');
  assert.equal(commentsBefore.items.length, 0);
  assert.equal((await request('/community/posts/' + post.id)).commentCount, 0);
  await request(
    '/admin/moderation/comments/' + comment.id + '/status',
    403,
    write('PATCH', ownerAuth, { status: 'APPROVED' }),
  );
  const commentQueue = await request('/admin/moderation/comments?status=PENDING&limit=50', 200, { headers: adminAuth });
  assert.ok(commentQueue.items.some((item) => item.id === comment.id));
  await request(
    '/admin/moderation/comments/' + comment.id + '/status',
    200,
    write('PATCH', adminAuth, { status: 'APPROVED', reason: 'Acceptance approval' }),
  );
  await request(
    '/admin/moderation/comments/' + comment.id + '/status',
    200,
    write('PATCH', adminAuth, { status: 'APPROVED' }),
  );
  assert.equal(await prisma.commentModerationAction.count({ where: { commentId: comment.id } }), 1);
  const commentsAfter = await request('/community/posts/' + post.id + '/comments?limit=5');
  assert.equal(commentsAfter.items[0].id, comment.id);
  assert.equal((await request('/community/posts/' + post.id)).commentCount, 1);
  await request('/community/comments/' + comment.id, 404, { method: 'DELETE', headers: outsiderAuth });
  await request('/community/posts/' + post.id + '/reports', 201, write('POST', ownerAuth, { reason: 'OTHER' }));
  await request('/community/posts/' + post.id + '/reports', 409, write('POST', ownerAuth, { reason: 'OTHER' }));
  await request('/community/comments/' + comment.id, 200, { method: 'DELETE', headers: ownerAuth });
  assert.equal((await request('/community/posts/' + post.id)).commentCount, 0);
  passed.push('comment moderation isolation, filtered counts, audits, deletion and report submission');

  const notifications = await request('/notifications?limit=20', 200, { headers: ownerAuth });
  const unread = await request('/notifications/unread-count', 200, { headers: ownerAuth });
  assert.ok(unread.count >= 3);
  const notification = notifications.items.find((item) => item.targetId === post.id);
  assert.ok(notification);
  await request('/notifications/' + notification.id + '/read', 404, write('PATCH', outsiderAuth));
  await request('/notifications/' + notification.id + '/read', 200, write('PATCH', ownerAuth));
  await request('/notifications/' + notification.id + '/read', 200, write('PATCH', ownerAuth));
  assert.equal((await request('/notifications/unread-count', 200, { headers: ownerAuth })).count, unread.count - 1);
  await request('/notifications/read-all', 200, write('PATCH', ownerAuth));
  assert.equal((await request('/notifications/unread-count', 200, { headers: ownerAuth })).count, 0);
  passed.push('system notification targets, unread counts, single and bulk read ownership');

  await request('/community/posts/' + post.id, 404, { method: 'DELETE', headers: outsiderAuth });
  await request('/community/posts/' + post.id, 200, { method: 'DELETE', headers: ownerAuth });
  await request('/community/posts/' + post.id, 404);
  await request('/body-profiles/' + profileId, 200, { method: 'DELETE', headers: ownerAuth });
  await request(
    '/generation-jobs',
    404,
    write('POST', ownerAuth, { ...jobInput, idempotencyKey: runId + '-archived' }),
  );
  await request('/wardrobe/items/' + clothing.id, 200, { method: 'DELETE', headers: ownerAuth });
  const disposable = await createImage(png, bootstrap.media?.uploadMode, ownerAuth);
  await request('/media/assets/' + disposable.id, 200, { method: 'DELETE', headers: ownerAuth });
  await request('/media/assets/' + disposable.id, 404, { headers: ownerAuth });
  passed.push('owned content deletion and inactive generation input rejection');

  const rotated = await request('/auth/refresh', 201, write('POST', {}, { refreshToken: owner.refreshToken }));
  assert.notEqual(rotated.refreshToken, owner.refreshToken);
  await request('/body-profiles', 200, { headers: authorization(rotated) });
  await request('/auth/refresh', 401, write('POST', {}, { refreshToken: owner.refreshToken }));
  await request('/body-profiles', 401, { headers: authorization(rotated) });
  await request('/auth/logout', 200, write('POST', outsiderAuth));
  await request('/body-profiles', 401, { headers: outsiderAuth });
  await prisma.user.update({ where: { id: owner.user.id }, data: { status: 'SUSPENDED' } });
  await request('/auth/wechat/login', 401, write('POST', {}, { code: 'local:' + runId + '-owner' }));
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } })).status, 'SUSPENDED');
  passed.push('refresh rotation, replay revocation, logout and suspended login denial');

  console.log(
    JSON.stringify(
      {
        mode: 'FREE_MODE/local-svg only',
        mediaUploadMode: bootstrap.media?.uploadMode ?? 'legacy-development-base64',
        requestCount,
        passed,
      },
      null,
      2,
    ),
  );
} finally {
  const userIds = [...fixtureUsers];
  if (userIds.length) {
    // User cascades cannot atomically delete S3 objects: retain durable final-object cleanup first.
    const assets = await prisma.mediaAsset.findMany({
      where: { ownerId: { in: userIds }, storageDriver: 's3', status: 'READY' },
      select: { objectKey: true },
    });
    for (const asset of assets)
      await prisma.objectCleanup.upsert({
        where: { objectKey: asset.objectKey },
        create: { objectKey: asset.objectKey, notBefore: new Date() },
        update: { notBefore: new Date() },
      });
    // Only data created by this run is removed; existing users and content are never reset.
    await prisma.commentModerationAction.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.generationJob.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.post.deleteMany({ where: { authorId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.$disconnect();
}
