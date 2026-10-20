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
let userId;
let postIds = [];
let requests = 0;

async function request(path, status = 200) {
  requests += 1;
  const response = await fetch(baseUrl + path, { signal: AbortSignal.timeout(15000) });
  const body = await response.json();
  assert.equal(response.status, status, `${path}: ${JSON.stringify(body)}`);
  return normalizeEnvelope(body);
}

try {
  const user = await db.user.create({ data: { wxOpenId: `fixture:discovery:${runId}` } });
  userId = user.id;
  const first = await db.post.create({
    data: {
      authorId: user.id,
      title: '莓红外套',
      body: '适合通勤的层次穿搭',
      topic: `通勤胶囊-${runId}`,
      imageAssetIds: [],
      moderationStatus: 'APPROVED',
    },
  });
  const second = await db.post.create({
    data: {
      authorId: user.id,
      title: '周末轻盈穿搭',
      body: '轻松的周末组合',
      topic: `周末灵感-${runId}`,
      imageAssetIds: [],
      moderationStatus: 'APPROVED',
    },
  });
  postIds = [first.id, second.id];
  const topics = await request(`/community/topics?search=${encodeURIComponent(runId)}`);
  assert.deepEqual(topics.items.sort(), [`周末灵感-${runId}`, `通勤胶囊-${runId}`].sort());
  const search = await request(`/community/posts?search=${encodeURIComponent('莓红')}&limit=20`);
  assert.equal(search.items.length, 1);
  assert.equal(search.items[0].id, first.id);
  console.log(
    JSON.stringify(
      {
        requests,
        passed: ['public topic directory', 'case-insensitive title/body/topic search'],
        mode: 'Real loopback HTTP/PostgreSQL with disposable fixture posts; no external services',
      },
      null,
      2,
    ),
  );
} finally {
  if (postIds.length) await db.post.deleteMany({ where: { id: { in: postIds } } });
  if (userId) await db.user.delete({ where: { id: userId } }).catch(() => undefined);
  await db.$disconnect();
}
