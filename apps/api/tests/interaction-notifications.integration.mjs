import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { normalizeEnvelope } from './api-envelope.mjs';
import { databaseTarget } from '../scripts/migration-tools.mjs';
import { notificationUrl } from '../../miniapp/src/features/notifications/notification-destination.ts';

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
async function login(name) {
  const session = await request('/auth/wechat/login', undefined, 201, 'POST', {
    code: `local:interaction:${runId}:${name}`,
  });
  users.push(session.user.id);
  return session;
}
try {
  assert.equal((await request('/system/bootstrap')).freeMode, true);
  const owner = await login('owner');
  const actor = await login('actor');
  const admin = await login('moderator');
  // Only these disposable fixture accounts/posts are set up through Prisma; all interactions use HTTP.
  await db.user.update({ where: { id: admin.user.id }, data: { role: 'MODERATOR' } });
  const post = await db.post.create({
    data: { authorId: owner.user.id, title: 'Interaction fixture', body: 'Fixture only', moderationStatus: 'APPROVED' },
  });
  const path = `/community/posts/${post.id}`;
  const count = () => db.notification.count({ where: { userId: owner.user.id, type: 'INTERACTION' } });
  const like = (token, active) => request(`${path}/like`, token, 201, 'POST', { active });
  await like(owner.accessToken, true);
  assert.equal(await count(), 0, 'Self likes must not alert the author');
  await Promise.all(Array.from({ length: 5 }, () => like(actor.accessToken, true)));
  assert.equal(await count(), 1);
  const likeMessage = (await request('/notifications', owner.accessToken)).items[0];
  assert.equal(likeMessage.type, 'INTERACTION');
  assert.equal(Object.hasOwn(likeMessage, 'eventKey'), false);
  await request(`/notifications/${likeMessage.id}/read`, owner.accessToken, 200, 'PATCH', {});
  await like(actor.accessToken, false);
  await like(actor.accessToken, true);
  assert.equal(await count(), 1, 'Unlike/re-like must not send another message');
  assert.equal((await request('/notifications/unread-count', owner.accessToken)).count, 0);
  await request(`/notifications/${likeMessage.id}/destination`, undefined, 401);
  await request(`/notifications/${likeMessage.id}/destination`, actor.accessToken, 404);
  const likeDestination = await request(`/notifications/${likeMessage.id}/destination`, owner.accessToken);
  assert.equal(notificationUrl(likeDestination), `/pages/post/index?id=${post.id}`);

  const comment = await request(`${path}/comments`, actor.accessToken, 201, 'POST', { body: 'A real HTTP comment' });
  assert.equal(await count(), 1, 'Pending comments must not alert the post author');
  await request(`${path}/comments/${comment.id}`, undefined, 404);
  const moderate = (status) =>
    request(`/admin/moderation/comments/${comment.id}/status`, admin.accessToken, 200, 'PATCH', { status });
  await request(`/admin/moderation/comments/${comment.id}/status`, owner.accessToken, 403, 'PATCH', {
    status: 'APPROVED',
  });
  await moderate('APPROVED');
  await moderate('APPROVED');
  assert.equal(await count(), 2);
  const message = (await request('/notifications', owner.accessToken)).items.find(
    (item) => item.commentId === comment.id,
  );
  assert.ok(message);
  await request(`/notifications/${message.id}/read`, owner.accessToken, 200, 'PATCH', {});
  await moderate('REJECTED');
  let destination = await request(`/notifications/${message.id}/destination`, owner.accessToken);
  assert.equal(destination.commentId, null);
  assert.ok(destination.notice);
  await moderate('APPROVED');
  assert.equal(await count(), 2, 'Re-approval must not duplicate interaction notifications');
  assert.equal((await request('/notifications/unread-count', owner.accessToken)).count, 0);

  // Make the original comment older than the first page; the message must still locate it directly.
  await db.comment.update({ where: { id: comment.id }, data: { createdAt: new Date('2020-01-01T00:00:00Z') } });
  await db.comment.createMany({
    data: Array.from({ length: 21 }, (_, i) => ({
      postId: post.id,
      authorId: actor.user.id,
      body: `Pagination fixture ${i}`,
      moderationStatus: 'APPROVED',
    })),
  });
  assert.equal(
    (await request(`${path}/comments?limit=20`)).items.some((item) => item.id === comment.id),
    false,
  );
  destination = await request(`/notifications/${message.id}/destination`, owner.accessToken);
  assert.equal(notificationUrl(destination), `/pages/post/index?id=${post.id}&commentId=${comment.id}`);
  assert.equal((await request(`${path}/comments/${destination.commentId}`)).body, 'A real HTTP comment');
  const otherPost = await db.post.create({
    data: { authorId: actor.user.id, title: 'Other', body: 'Fixture only', moderationStatus: 'APPROVED' },
  });
  await request(`/community/posts/${otherPost.id}/comments/${comment.id}`, undefined, 404);
  const firstPage = await request('/notifications?limit=1', owner.accessToken);
  const secondPage = await request(
    `/notifications?limit=1&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
    owner.accessToken,
  );
  assert.notEqual(firstPage.items[0].id, secondPage.items[0].id);
  await request(`/community/comments/${comment.id}`, actor.accessToken, 200, 'DELETE');
  destination = await request(`/notifications/${message.id}/destination`, owner.accessToken);
  assert.equal(destination.kind, 'POST');
  assert.equal(destination.commentId, null);
  assert.ok(destination.notice);
  await request(`${path}/comments/${comment.id}`, undefined, 404);
  await request(path, owner.accessToken, 200, 'DELETE');
  assert.equal((await request(`/notifications/${message.id}/destination`, owner.accessToken)).kind, 'UNAVAILABLE');
  await request(`${path}/like`, actor.accessToken, 404, 'POST', { active: true });

  await request(`/community/users/${owner.user.id}/follow`, actor.accessToken, 200, 'PUT', { active: true });
  const followMessage = (await request('/notifications', owner.accessToken)).items.find(
    (item) => item.type === 'FOLLOW',
  );
  assert.equal(
    notificationUrl(await request(`/notifications/${followMessage.id}/destination`, owner.accessToken)),
    '/pages/follows/index?mode=followers',
  );
  console.log(
    JSON.stringify(
      {
        requests,
        passed: [
          'concurrent likes and self suppression',
          'read state retained after re-like/re-approval',
          'moderation-gated comment delivery',
          'owner-only destinations',
          'exact old-comment lookup and client route mapping',
          'deleted/rejected comment fallback',
          'deleted post fallback',
          'message pagination',
          'follow message routing',
        ],
        mode: 'Real local HTTP/PostgreSQL with explicit fixture accounts/posts; Taro route mapper executed; WeChat device rendering not tested',
      },
      null,
      2,
    ),
  );
} finally {
  await db.commentModerationAction.deleteMany({ where: { actorId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
