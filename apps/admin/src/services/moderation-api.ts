import type { CursorPage, ModerationQueueItem, ModerationStatus } from '@lumi/contracts';
import { adminRequest, apiUrl } from './admin-session';

export const moderationApiConfig = {
  enabled: true,
  apiUrl: apiUrl(),
};

export function listModerationPosts(): Promise<CursorPage<ModerationQueueItem>> {
  return adminRequest('/admin/moderation/posts?limit=20');
}

export function updateModerationStatus(
  postId: string,
  status: Exclude<ModerationStatus, 'PENDING'>,
): Promise<ModerationQueueItem> {
  return adminRequest(`/admin/moderation/posts/${postId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export type CommentModerationItem = {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  moderationStatus: ModerationStatus;
  createdAt: string;
};

export type CommentModerationResult = { id: string; status: ModerationStatus };

export function listModerationComments(status: ModerationStatus, cursor?: string) {
  const params = new URLSearchParams({ status, limit: '20' });
  if (cursor) params.set('cursor', cursor);
  return adminRequest<{ items: CommentModerationItem[]; nextCursor: string | null }>(
    `/admin/moderation/comments?${params.toString()}`,
  );
}

export function updateCommentModerationStatus(
  commentId: string,
  status: Exclude<ModerationStatus, 'PENDING'>,
  reason: string,
): Promise<CommentModerationResult> {
  return adminRequest(`/admin/moderation/comments/${commentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
}

export type AdminOverview = {
  pendingPosts: number;
  generationToday: number;
  failedGenerations: number;
  communityPosts: number;
  openReports: number;
};

export function getAdminOverview(): Promise<AdminOverview> {
  return adminRequest('/admin/overview');
}
