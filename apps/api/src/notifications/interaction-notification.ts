import type { Prisma } from '@prisma/client';

type InteractionEvent = {
  actorId: string;
  recipientId: string;
  postId: string;
  commentId?: string;
};

// Called inside the originating write transaction so a successful interaction cannot lose its message.
// A stable event key also prevents unlike/re-like and repeated moderation from re-alerting the recipient.
export async function notifyInteraction(tx: Prisma.TransactionClient, event: InteractionEvent) {
  if (event.actorId === event.recipientId) return;
  await tx.notification.createMany({
    data: [
      {
        userId: event.recipientId,
        type: 'INTERACTION',
        title: event.commentId ? '你的穿搭收到新评论' : '有人赞了你的穿搭',
        body: event.commentId ? '一条新评论已通过审核，点击查看。' : '你的穿搭收到了一个赞，点击查看。',
        targetType: 'POST',
        targetId: event.postId,
        commentId: event.commentId ?? null,
        eventKey: event.commentId ? `comment:${event.commentId}` : `like:${event.postId}:${event.actorId}`,
      },
    ],
    skipDuplicates: true,
  });
}
