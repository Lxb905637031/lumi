import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CommunityComment, CommunityPost, CursorPage } from '@lumi/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';
import type { CursorPaginationDto } from '../common/pagination/pagination.dto';

type PostWithCounts = Prisma.PostGetPayload<{
  include: {
    author: { select: { id: true; wxOpenId: true } };
    _count: { select: { likes: true; comments: { where: { moderationStatus: 'APPROVED' } }; bookmarks: true } };
  };
}>;

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

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
    const imagePreviews = await this.findImagePreviews(items);
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
    const imagePreviews = await this.findImagePreviews([post]);
    return {
      ...this.toPost(post, imagePreviews.get(post.id) ?? []),
    };
  }

  async create(
    userId: string,
    input: { title: string; body: string; imageAssetIds: string[]; topic?: string; isAiGenerated?: boolean },
  ) {
    const imageAssetIds = input.imageAssetIds ?? [];
    if (imageAssetIds.length) {
      const count = await this.prisma.mediaAsset.count({
        where: { id: { in: imageAssetIds }, ownerId: userId, deletedAt: null },
      });
      if (count !== imageAssetIds.length) throw new NotFoundException('帖子图片不存在');
    }
    const post = await this.prisma.post.create({
      data: {
        authorId: userId,
        title: input.title,
        body: input.body,
        imageAssetIds,
        topic: input.topic,
        isAiGenerated: input.isAiGenerated ?? false,
      },
      include: {
        author: { select: { id: true, wxOpenId: true } },
        _count: { select: { likes: true, comments: { where: { moderationStatus: 'APPROVED' } }, bookmarks: true } },
      },
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
    const existing = await this.prisma.postReport.findFirst({ where: { postId, reporterId: userId, status: 'OPEN' } });
    if (existing) throw new ConflictException('你已经举报过该内容');
    await this.prisma.postReport.create({ data: { postId, reporterId: userId, reason } });
    return { success: true };
  }

  private async assertApproved(postId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, moderationStatus: 'APPROVED', deletedAt: null },
      select: { id: true },
    });
    if (!post) throw new NotFoundException('帖子不存在');
  }

  private async findImagePreviews(posts: PostWithCounts[]) {
    const idsByPost = new Map(posts.map((post) => [post.id, this.readImageIds(post.imageAssetIds)]));
    const allIds = [...new Set([...idsByPost.values()].flat())];
    if (!allIds.length) return new Map<string, string[]>();
    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: allIds }, visibility: 'PUBLIC', deletedAt: null },
      select: { id: true, previewData: true },
    });
    const previewById = new Map(
      assets.filter((asset) => asset.previewData).map((asset) => [asset.id, asset.previewData!]),
    );
    return new Map(
      [...idsByPost].map(([postId, assetIds]) => [
        postId,
        assetIds.flatMap((id) => (previewById.has(id) ? [previewById.get(id)!] : [])),
      ]),
    );
  }

  private readImageIds(imageAssetIds: Prisma.JsonValue): string[] {
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
