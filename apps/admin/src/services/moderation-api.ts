import type { CursorPage, ModerationQueueItem, ModerationStatus, ReportQueueItem, ReportStatus } from '@lumi/contracts';
import { adminRequest, apiUrl } from './admin-session';

export const moderationApiConfig = {
  enabled: true,
  apiUrl: apiUrl(),
};

export function listModerationPosts(
  status: ModerationStatus = 'PENDING',
  cursor?: string,
): Promise<CursorPage<ModerationQueueItem>> {
  const params = new URLSearchParams({ status, limit: '20' });
  if (cursor) params.set('cursor', cursor);
  return adminRequest(`/admin/moderation/posts?${params.toString()}`);
}

export function updateModerationStatus(
  postId: string,
  status: Exclude<ModerationStatus, 'PENDING'>,
  reason = '',
): Promise<ModerationQueueItem> {
  return adminRequest(`/admin/moderation/posts/${postId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason: reason.trim() || undefined }),
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

export function listModerationReports(status: ReportStatus = 'OPEN', cursor?: string) {
  const params = new URLSearchParams({ status, limit: '20' });
  if (cursor) params.set('cursor', cursor);
  return adminRequest<CursorPage<ReportQueueItem>>(`/admin/moderation/reports?${params.toString()}`);
}

export function updateReportStatus(id: string, status: Exclude<ReportStatus, 'OPEN'>, reason: string) {
  return adminRequest<ReportQueueItem>(`/admin/moderation/reports/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason: reason.trim() }),
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
