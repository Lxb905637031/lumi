import type {
  Announcement,
  AdminUser,
  CursorPage,
  ModerationQueueItem,
  ModerationStatus,
  ReportQueueItem,
  ReportStatus,
} from '@lumi/contracts';
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

export function listAnnouncements(): Promise<CursorPage<Announcement>> {
  return adminRequest('/admin/announcements?limit=20');
}

export function createAnnouncement(input: {
  idempotencyKey: string;
  title: string;
  body: string;
}): Promise<Announcement> {
  return adminRequest('/admin/announcements', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAnnouncement(
  id: string,
  input: { expectedVersion: number; title: string; body: string },
): Promise<Announcement> {
  return adminRequest(`/admin/announcements/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function publishAnnouncement(id: string, expectedVersion: number): Promise<Announcement> {
  return adminRequest(`/admin/announcements/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  });
}

export function listAdminUsers(status?: 'ACTIVE' | 'SUSPENDED' | 'DELETED', search?: string) {
  const params = new URLSearchParams({ limit: '20' });
  if (status) params.set('status', status);
  if (search?.trim()) params.set('search', search.trim());
  return adminRequest<CursorPage<AdminUser>>(`/admin/users?${params.toString()}`);
}

export function updateAdminUser(
  id: string,
  input: {
    status?: 'ACTIVE' | 'SUSPENDED';
    role?: 'USER' | 'MODERATOR' | 'ADMIN';
    expectedUpdatedAt: string;
    reason: string;
  },
) {
  return adminRequest<AdminUser>(`/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export type UserModerationAction = {
  id: string;
  actorId: string | null;
  fromStatus: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  toStatus: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  fromRole: 'USER' | 'MODERATOR' | 'ADMIN';
  toRole: 'USER' | 'MODERATOR' | 'ADMIN';
  reason: string;
  createdAt: string;
};

export function listUserModerationActions(id: string) {
  return adminRequest<CursorPage<UserModerationAction>>(`/admin/users/${id}/actions?limit=20`);
}
