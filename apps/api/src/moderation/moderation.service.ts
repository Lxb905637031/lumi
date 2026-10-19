import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CursorPage, ModerationQueueItem } from '@lumi/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { ModerationQueueQueryDto, UpdateModerationStatusDto } from './moderation.dto';

type ModeratedPost = Prisma.PostGetPayload<{
  include: { author: { select: { id: true } } };
}>;

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async listPosts(query: ModerationQueueQueryDto): Promise<CursorPage<ModerationQueueItem>> {
    const cursor = decodeTimestampCursor(query.cursor);
    const posts = await this.prisma.post.findMany({
      where: {
        ...(query.status ? { moderationStatus: query.status } : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.timestamp) } },
                {
                  createdAt: new Date(cursor.timestamp),
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: { author: { select: { id: true } } },
    });
    const hasNextPage = posts.length > query.limit;
    const items = (hasNextPage ? posts.slice(0, query.limit) : posts).map((post) => this.toQueueItem(post));
    const last = posts.at(Math.min(posts.length, query.limit) - 1);
    return {
      items,
      nextCursor:
        hasNextPage && last ? encodeTimestampCursor({ timestamp: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async updatePostStatus(postId: string, actorId: string, input: UpdateModerationStatusDto) {
    const current = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!current) throw new NotFoundException('审核内容不存在');
    if (current.moderationStatus === input.status) return this.findPost(postId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.post.updateMany({
        where: { id: postId, moderationStatus: current.moderationStatus },
        data: { moderationStatus: input.status },
      });
      if (changed.count !== 1) {
        throw new ConflictException('审核状态已被其他管理员更新，请刷新后重试');
      }
      const post = await tx.post.findUniqueOrThrow({
        where: { id: postId },
        include: { author: { select: { id: true } } },
      });
      await tx.moderationAction.create({
        data: {
          postId,
          actorId,
          fromStatus: current.moderationStatus,
          toStatus: input.status,
          reason: input.reason,
        },
      });
      const imageAssetIds = Array.isArray(current.imageAssetIds)
        ? current.imageAssetIds.filter((id): id is string => typeof id === 'string')
        : [];
      if (imageAssetIds.length) {
        await tx.mediaAsset.updateMany({
          where: { id: { in: imageAssetIds }, ownerId: current.authorId, deletedAt: null },
          data: { visibility: input.status === 'APPROVED' ? 'PUBLIC' : 'PRIVATE' },
        });
      }
      await tx.notification.create({
        data: {
          userId: post.author.id,
          type: 'MODERATION',
          title: input.status === 'APPROVED' ? '帖子已通过审核' : '帖子审核状态已更新',
          body: input.reason ?? `你的帖子状态已更新为 ${input.status}`,
          targetType: 'POST',
          targetId: post.id,
        },
      });
      return post;
    });
    return this.toQueueItem(updated);
  }

  private findPost(postId: string) {
    return this.prisma.post
      .findUniqueOrThrow({
        where: { id: postId },
        include: { author: { select: { id: true } } },
      })
      .then((post) => this.toQueueItem(post));
  }

  private toQueueItem(post: ModeratedPost): ModerationQueueItem {
    return {
      id: post.id,
      title: post.title,
      bodyPreview: post.body.slice(0, 160),
      submittedBy: post.author.id,
      status: post.moderationStatus,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }
}
