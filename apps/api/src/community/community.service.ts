import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { Prisma as PrismaTypes } from '@prisma/client';
import type { CommunityComment, CommunityPost, CreateCommunityPostInput, CursorPage } from '@lumi/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { CursorPaginationDto } from '../common/pagination/pagination.dto';
import { MediaService } from '../media/media.service';

type PostWithCounts = PrismaTypes.PostGetPayload<{
  include: {
    author: { select: { id: true; wxOpenId: true } };
    _count: { select: { likes: true; comments: { where: { moderationStatus: 'APPROVED' } }; bookmarks: true } };
  };
}>;

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async interactionState(userId: string, postId: string) {
    await this.assertApproved(postId);
    const [like, bookmark] = await Promise.all([
      this.prisma.postLike.findUnique({ where: { postId_userId: { postId, userId } }, select: { id: true } }),
      this.prisma.postBookmark.findUnique({ where: { postId_userId: { postId, userId } }, select: { id: true } }),
    ]);
    return { liked: Boolean(like), bookmarked: Boolean(bookmark) };
  }

  async listComments(postId: string, pagination: CursorPaginationDto): Promise<CursorPage<CommunityComment>> {
    await this.assertApproved(postId);
    const cursor = decodeTimestampCursor(pagination.cursor);
    const rows = await this.prisma.comment.findMany({
      where: {
        postId,
        moderationStatus: 'APPROVED',
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.timestamp) } },
                { createdAt: new Date(cursor.timestamp), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pagination.limit + 1,
      include: { author: { select: { id: true, wxOpenId: true } } },
    });
    const hasNext = rows.length > pagination.limit;
    const items = hasNext ? rows.slice(0, pagination.limit) : rows;
    const last = items.at(-1);
    return {
      items: items.map((comment) => this.toComment(comment)),
      nextCursor:
        hasNext && last ? encodeTimestampCursor({ timestamp: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async list(
    pagination: CursorPaginationDto,
    topic?: string,
    ownerId?: string,
    bookmarkUserId?: string,
  ): Promise<CursorPage<CommunityPost>> {
    const cursor = decodeTimestampCursor(pagination.cursor);
    const posts = await this.prisma.post.findMany({
      where: {
        ...(ownerId ? { authorId: ownerId } : { moderationStatus: 'APPROVED' as const }),
        ...(bookmarkUserId ? { bookmarks: { some: { userId: bookmarkUserId } } } : {}),
        deletedAt: null,
        ...(topic ? { topic } : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.timestamp) } },
                { createdAt: new Date(cursor.timestamp), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pagination.limit + 1,
      include: {
        author: { select: { id: true, wxOpenId: true } },
        _count: { select: { likes: true, comments: { where: { moderationStatus: 'APPROVED' } }, bookmarks: true } },
      },
    });
    const hasNext = posts.length > pagination.limit;
    const items = hasNext ? posts.slice(0, pagination.limit) : posts;
    const last = items.at(-1);
    const imagePreviews = await this.media.previewsForPosts(items, ownerId);
    return {
      items: items.map((post) => this.toPost(post, imagePreviews.get(post.id) ?? [])),
      nextCursor:
        hasNext && last ? encodeTimestampCursor({ timestamp: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async findPublic(id: string) {
    const post = await this.prisma.post.findFirst({
      where: { id, moderationStatus: 'APPROVED', deletedAt: null },
      include: {
        author: { select: { id: true, wxOpenId: true } },
        _count: { select: { likes: true, comments: { where: { moderationStatus: 'APPROVED' } }, bookmarks: true } },
      },
    });
    if (!post) throw new NotFoundException('帖子不存在');
    const imagePreviews = await this.media.previewsForPosts([post]);
    return {
      ...this.toPost(post, imagePreviews.get(post.id) ?? []),
    };
  }

  async create(userId: string, input: CreateCommunityPostInput) {
    const imageAssetIds = input.imageAssetIds;
    const content = {
      title: input.title.trim(),
      body: input.body.trim(),
      topic: input.topic?.trim() || null,
      imageAssetIds,
      isAiGenerated: input.isAiGenerated ?? false,
    };
    const requestHash = createHash('sha256').update(JSON.stringify(content)).digest('hex');
    const post = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR NO KEY UPDATE`;
      const existing = await tx.post.findUnique({
        where: { authorId_idempotencyKey: { authorId: userId, idempotencyKey: input.idempotencyKey } },
        include: {
          author: { select: { id: true, wxOpenId: true } },
          _count: { select: { likes: true, comments: { where: { moderationStatus: 'APPROVED' } }, bookmarks: true } },
        },
      });
      if (existing) {
        if (existing.requestHash !== requestHash) throw new ConflictException('发布请求标识已用于不同内容');
        if (existing.deletedAt) throw new ConflictException('原发布内容已删除，请勿重复发布');
        return existing;
      }
      // Lock in stable order to serialize with deletion; no external storage work under this lock.
      for (const id of [...imageAssetIds].sort())
        await tx.$queryRaw`SELECT id FROM media_assets WHERE id = ${id} AND owner_id = ${userId} FOR UPDATE`;
      const assets = await tx.mediaAsset.findMany({
        where: { id: { in: imageAssetIds }, ownerId: userId, status: 'READY', deletedAt: null },
        select: { id: true, generationOutputs: { select: { deletedAt: true, selectedAt: true } } },
      });
      if (assets.length !== imageAssetIds.length) throw new NotFoundException('帖子图片不存在');
      const generated = assets.flatMap((asset) => asset.generationOutputs);
      if (generated.some((output) => output.deletedAt || !output.selectedAt))
        throw new ConflictException('请先确认生成结果再发布');
      return tx.post.create({
        data: {
          authorId: userId,
          title: content.title,
          body: content.body,
          imageAssetIds,
          topic: content.topic,
          idempotencyKey: input.idempotencyKey,
          requestHash,
          isAiGenerated: generated.length > 0 || (input.isAiGenerated ?? false),
        },
        include: {
          author: { select: { id: true, wxOpenId: true } },
          _count: { select: { likes: true, comments: { where: { moderationStatus: 'APPROVED' } }, bookmarks: true } },
        },
      });
    });
    return this.toPost(post);
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.post.updateMany({
      where: { id, authorId: userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count !== 1) throw new NotFoundException('帖子不存在');
    return { success: true };
  }

  async setLike(userId: string, postId: string, active: boolean) {
    await this.assertApproved(postId);
    if (!active) {
      await this.prisma.postLike.deleteMany({ where: { postId, userId } });
      return { liked: false };
    }
    await this.prisma.postLike.createMany({ data: [{ postId, userId }], skipDuplicates: true });
    return { liked: true };
  }

  async setBookmark(userId: string, postId: string, active: boolean) {
    await this.assertApproved(postId);
    if (!active) {
      await this.prisma.postBookmark.deleteMany({ where: { postId, userId } });
      return { bookmarked: false };
    }
    await this.prisma.postBookmark.createMany({ data: [{ postId, userId }], skipDuplicates: true });
    return { bookmarked: true };
  }

  async addComment(userId: string, postId: string, body: string): Promise<CommunityComment> {
    await this.assertApproved(postId);
    const comment = await this.prisma.comment.create({
      data: { postId, authorId: userId, body },
      include: { author: { select: { id: true, wxOpenId: true } } },
    });
    return this.toComment(comment);
  }

  async removeComment(userId: string, commentId: string) {
    const result = await this.prisma.comment.deleteMany({ where: { id: commentId, authorId: userId } });
    if (result.count !== 1) throw new NotFoundException('评论不存在');
    return { success: true };
  }

  async report(userId: string, postId: string, reason: string) {
    await this.assertApproved(postId);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM posts WHERE id = ${postId} FOR UPDATE`;
        const existing = await tx.postReport.findFirst({ where: { postId, reporterId: userId, status: 'OPEN' } });
        if (existing) throw new ConflictException('你已经举报过该内容');
        await tx.postReport.create({ data: { postId, reporterId: userId, reason } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('你已经举报过该内容');
      }
      throw error;
    }
    return { success: true };
  }

  private async assertApproved(postId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, moderationStatus: 'APPROVED', deletedAt: null },
      select: { id: true },
    });
    if (!post) throw new NotFoundException('帖子不存在');
  }

  private readImageIds(imageAssetIds: PrismaTypes.JsonValue): string[] {
    return Array.isArray(imageAssetIds) ? imageAssetIds.filter((id): id is string => typeof id === 'string') : [];
  }

  private toPost(post: PostWithCounts, imagePreviews: string[] = []): CommunityPost {
    const imageAssetIds = this.readImageIds(post.imageAssetIds);
    return {
      id: post.id,
      authorId: post.author.id,
      authorName: `Lumi 用户 ${post.author.id.slice(-6)}`,
      title: post.title,
      body: post.body,
      topic: post.topic,
      imageAssetIds,
      imagePreviews,
      isAiGenerated: post.isAiGenerated,
      moderationStatus: post.moderationStatus,
      featuredAt: post.featuredAt?.toISOString() ?? null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      bookmarkCount: post._count.bookmarks,
      liked: false,
      bookmarked: false,
    };
  }

  private toComment(comment: {
    id: string;
    postId: string;
    authorId: string;
    body: string;
    createdAt: Date;
    author: { id: string; wxOpenId: string };
  }): CommunityComment {
    return {
      id: comment.id,
      postId: comment.postId,
      authorId: comment.author.id,
      authorName: `Lumi 用户 ${comment.author.id.slice(-6)}`,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    };
  }
}
