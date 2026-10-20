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
const assets = [];
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
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
  return normalizeEnvelope(result);
}

async function login(label) {
  const session = await request('/auth/wechat/login', undefined, 201, 'POST', {
    code: `local:media-moderation:${runId}:${label}`,
  });
  users.push(session.user.id);
  return session;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await promisify(scrypt)(password, salt, 64);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

async function createAsset(ownerId, suffix) {
  const asset = await db.mediaAsset.create({
    data: {
      ownerId,
      objectKey: `local/${ownerId}/${runId}/${suffix}.png`,
      storageDriver: 'local',
      mimeType: 'image/png',
      byteSize: 68,
      width: 1,
      height: 1,
      sha256: `${runId}-${suffix}`,
      previewData:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    },
  });
  assets.push(asset.id);
  return { ...asset, url: asset.previewData };
}

try {
  assert.equal((await request('/system/bootstrap')).freeMode, true);
  const owner = await login('owner');
  const normal = await login('normal');
  const adminFixture = await login('admin');
  await db.user.update({ where: { id: adminFixture.user.id }, data: { role: 'ADMIN' } });
  const username = `media-moderation-${runId}`;
  const password = `local-${runId}-admin`;
  await db.adminCredential.create({
    data: { userId: adminFixture.user.id, username, passwordHash: await hashPassword(password) },
  });
  const admin = await request('/auth/admin/login', undefined, 201, 'POST', { username, password });

  const profileAsset = await createAsset(owner.user.id, 'profile');
  const clothingAsset = await createAsset(owner.user.id, 'clothing');
  const clothingAssetTwo = await createAsset(owner.user.id, 'clothing-two');
  const clothingAssetThree = await createAsset(owner.user.id, 'clothing-three');
  const unrelatedAssetOne = await createAsset(owner.user.id, 'unrelated-one');
  const unrelatedAssetTwo = await createAsset(owner.user.id, 'unrelated-two');
  const profile = await request('/body-profiles', owner.accessToken, 201, 'POST', {
    name: '审核素材人物',
    sourceAssetId: profileAsset.id,
  });
  const clothing = await request('/wardrobe/items', owner.accessToken, 201, 'POST', {
    name: '审核素材上衣',
    category: 'TOP',
    assetId: clothingAsset.id,
  });
  await request('/wardrobe/items', owner.accessToken, 201, 'POST', {
    name: '审核素材下装',
    category: 'BOTTOM',
    assetId: clothingAssetTwo.id,
  });
  await request('/wardrobe/items', owner.accessToken, 201, 'POST', {
    name: '审核素材连衣裙',
    category: 'DRESS',
    assetId: clothingAssetThree.id,
  });

  const orderedUpdatedAt = Date.now();
  for (const [asset, offset] of [
    [clothingAsset, 5000],
    [clothingAssetTwo, 4000],
    [clothingAssetThree, 3000],
    [unrelatedAssetOne, 2000],
    [unrelatedAssetTwo, 1000],
  ]) {
    await db.mediaAsset.update({
      where: { id: asset.id },
      data: { updatedAt: new Date(orderedUpdatedAt - offset) },
    });
  }

  await request('/admin/moderation/media', normal.accessToken, 403);
  let page = await request('/admin/moderation/media?status=UNREVIEWED&limit=50', admin.accessToken);
  const profileRow = page.items.find((item) => item.id === profileAsset.id);
  const clothingRow = page.items.find((item) => item.id === clothingAsset.id);
  assert.equal(profileRow.kind, 'PROFILE');
  assert.equal(clothingRow.kind, 'CLOTHING');
  assert.match(profileRow.url, /^data:image\//);
  await request(`/admin/moderation/media/${clothingAsset.id}/status`, normal.accessToken, 403, 'PATCH', {
    status: 'REJECTED',
    expectedUpdatedAt: clothingRow.updatedAt,
    reason: '图片内容不符合规范',
  });
  const rejected = await request(
    `/admin/moderation/media/${clothingAsset.id}/status`,
    admin.accessToken,
    200,
    'PATCH',
    {
      status: 'REJECTED',
      expectedUpdatedAt: clothingRow.updatedAt,
      reason: '图片内容不符合规范',
    },
  );
  assert.equal(rejected.reviewStatus, 'REJECTED');
  await request(`/admin/moderation/media/${clothingAsset.id}/status`, admin.accessToken, 409, 'PATCH', {
    status: 'APPROVED',
    expectedUpdatedAt: clothingRow.updatedAt,
    reason: '旧版本通过',
  });
  const history = await request(`/admin/moderation/media/${clothingAsset.id}/actions?limit=20`, admin.accessToken);
  assert.equal(history.items.length, 1);
  assert.equal(history.items[0].toStatus, 'REJECTED');
  const filtered = await request('/admin/moderation/media?status=REJECTED&kind=CLOTHING&limit=20', admin.accessToken);
  assert.equal(
    filtered.items.some((item) => item.id === clothingAsset.id),
    true,
  );
  const filteredFirstPage = await request(
    '/admin/moderation/media?status=UNREVIEWED&kind=CLOTHING&limit=1',
    admin.accessToken,
  );
  assert.equal(filteredFirstPage.items.length, 1);
  assert.equal(filteredFirstPage.items[0].kind, 'CLOTHING');
  assert.ok(filteredFirstPage.nextCursor);
  const filteredSecondPage = await request(
    `/admin/moderation/media?status=UNREVIEWED&kind=CLOTHING&limit=1&cursor=${encodeURIComponent(filteredFirstPage.nextCursor)}`,
    admin.accessToken,
  );
  assert.equal(filteredSecondPage.items.length, 1);
  assert.equal(filteredSecondPage.items[0].kind, 'CLOTHING');
  assert.notEqual(filteredSecondPage.items[0].id, filteredFirstPage.items[0].id);
  assert.ok([clothingAsset.id, clothingAssetTwo.id, clothingAssetThree.id].includes(filteredFirstPage.items[0].id));
  assert.ok([clothingAsset.id, clothingAssetTwo.id, clothingAssetThree.id].includes(filteredSecondPage.items[0].id));
  await request('/generation-jobs', owner.accessToken, 409, 'POST', {
    profileVersionId: profile.id,
    clothingAssetId: clothing.id,
    idempotencyKey: `media-review-${runId}`,
  });

  console.log(
    JSON.stringify(
      {
        requests,
        passed: [
          'moderator-only media queue and kind resolution',
          'private signed/local media preview remains owner-scoped',
          'review action RBAC, reason and optimistic timestamp conflict',
          'media audit history and filtered queue',
          'rejected clothing input is blocked from generation',
        ],
        mode: 'Real loopback HTTP/PostgreSQL with disposable local fixture assets; no external services',
      },
      null,
      2,
    ),
  );
} finally {
  await db.mediaReviewAction.deleteMany({ where: { assetId: { in: assets } } });
  await db.mediaAsset.deleteMany({ where: { id: { in: assets } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
