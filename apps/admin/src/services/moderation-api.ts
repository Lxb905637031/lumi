import type {
  Announcement,
  AdminUser,
  CursorPage,
  ModerationQueueItem,
  ModerationStatus,
  ReportQueueItem,
  ReportStatus,
  AdminMediaAsset,
} from '@lumi/contracts';
import { adminRequest, apiUrl } from './admin-session';

export const moderationApiConfig = {
  enabled: true,
  apiUrl: apiUrl(),
};

export function listModerationPosts(
  status: ModerationStatus = 'PENDING',
  cursor?: string,
  challengeId?: string,
): Promise<CursorPage<ModerationQueueItem>> {
  const params = new URLSearchParams({ status, limit: '20' });
  if (cursor) params.set('cursor', cursor);
  if (challengeId) params.set('challengeId', challengeId);
  return adminRequest(`/admin/moderation/posts?${params.toString()}`);
}

export type AdminChallenge = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
  startsAt: string;
  endsAt: string;
  participantCount: number;
  pendingPostCount: number;
};

export function listAdminChallenges(status?: AdminChallenge['status'], cursor?: string) {
  const params = new URLSearchParams({ limit: '20' });
  if (status) params.set('status', status);
  if (cursor) params.set('cursor', cursor);
  return adminRequest<CursorPage<AdminChallenge>>(`/admin/challenges?${params.toString()}`);
}

export function createAdminChallenge(input: {
  slug: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
}) {
  return adminRequest<AdminChallenge>('/admin/challenges', { method: 'POST', body: JSON.stringify(input) });
}

export function publishAdminChallenge(id: string) {
  return adminRequest<AdminChallenge>(`/admin/challenges/${id}/publish`, { method: 'POST' });
}

export function closeAdminChallenge(id: string) {
  return adminRequest<AdminChallenge>(`/admin/challenges/${id}/close`, { method: 'PATCH' });
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

export function updateModerationStatuses(postIds: string[], status: Exclude<ModerationStatus, 'PENDING'>, reason = '') {
  return adminRequest<{
    items: ModerationQueueItem[];
    updatedCount: number;
    skippedCount: number;
  }>('/admin/moderation/posts/batch/status', {
    method: 'PATCH',
    body: JSON.stringify({ ids: postIds, status, reason: reason.trim() || undefined }),
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

export type CommentModerationAction = {
  id: string;
  actorId: string;
  fromStatus: ModerationStatus;
  toStatus: ModerationStatus;
  reason: string | null;
  createdAt: string;
};

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

export function updateCommentModerationStatuses(
  commentIds: string[],
  status: Exclude<ModerationStatus, 'PENDING'>,
  reason: string,
) {
  return adminRequest<{ ids: string[]; updatedCount: number; skippedCount: number }>(
    '/admin/moderation/comments/batch/status',
    {
      method: 'PATCH',
      body: JSON.stringify({ ids: commentIds, status, reason: reason.trim() || undefined }),
    },
  );
}

export function listCommentModerationActions(commentId: string, cursor?: string) {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);
  return adminRequest<{ items: CommentModerationAction[]; nextCursor: string | null }>(
    `/admin/moderation/comments/${commentId}/actions?${params.toString()}`,
  );
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

export type MediaReviewStatus = 'UNREVIEWED' | 'APPROVED' | 'REJECTED';
export type MediaReviewKind = 'PROFILE' | 'CLOTHING' | 'GENERATION_OUTPUT' | 'UPLOAD';

export function listMediaModeration(status: MediaReviewStatus = 'UNREVIEWED', kind?: MediaReviewKind, cursor?: string) {
  const params = new URLSearchParams({ status, limit: '20' });
  if (kind) params.set('kind', kind);
  if (cursor) params.set('cursor', cursor);
  return adminRequest<CursorPage<AdminMediaAsset>>(`/admin/moderation/media?${params.toString()}`);
}

export function updateMediaModerationStatus(
  id: string,
  status: Exclude<MediaReviewStatus, 'UNREVIEWED'>,
  expectedUpdatedAt: string,
  reason: string,
) {
  return adminRequest<AdminMediaAsset>(`/admin/moderation/media/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, expectedUpdatedAt, reason: reason.trim() || undefined }),
  });
}

export function updateMediaModerationStatuses(
  items: Array<{ id: string; expectedUpdatedAt: string }>,
  status: Exclude<MediaReviewStatus, 'UNREVIEWED'>,
  reason: string,
) {
  return adminRequest<{
    items: AdminMediaAsset[];
    updatedCount: number;
    skippedCount: number;
  }>('/admin/moderation/media/batch/status', {
    method: 'PATCH',
    body: JSON.stringify({ items, status, reason: reason.trim() || undefined }),
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

export type AdminAuditType = 'POST' | 'COMMENT' | 'MEDIA' | 'USER';
export type AdminAuditItem = {
  id: string;
  type: AdminAuditType;
  targetId: string;
  actorId: string | null;
  fromStatus: string;
  toStatus: string;
  reason: string | null;
  createdAt: string;
};

export function listAdminAudit(input: { type?: AdminAuditType; actorId?: string; targetId?: string; cursor?: string }) {
  const params = new URLSearchParams({ limit: '20' });
  if (input.type) params.set('type', input.type);
  if (input.actorId?.trim()) params.set('actorId', input.actorId.trim());
  if (input.targetId?.trim()) params.set('targetId', input.targetId.trim());
  if (input.cursor) params.set('cursor', input.cursor);
  return adminRequest<CursorPage<AdminAuditItem>>(`/admin/audit?${params.toString()}`);
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

export function listAdminUsers(
  status?: 'ACTIVE' | 'SUSPENDED' | 'DELETED',
  role?: 'USER' | 'MODERATOR' | 'ADMIN',
  search?: string,
  cursor?: string,
) {
  const params = new URLSearchParams({ limit: '20' });
  if (status) params.set('status', status);
  if (role) params.set('role', role);
  if (search?.trim()) params.set('search', search.trim());
  if (cursor) params.set('cursor', cursor);
  return adminRequest<CursorPage<AdminUser>>(`/admin/users?${params.toString()}`);
}

export type RuntimeConfig = {
  id: string;
  key: string;
  version: number;
  value: Record<string, unknown>;
  reason: string;
  actorId: string;
  createdAt: string;
};

export function listRuntimeConfigs() {
  return adminRequest<{ items: RuntimeConfig[] }>('/admin/runtime-configs');
}

export function listRuntimeConfigHistory(key: string) {
  return adminRequest<{ items: RuntimeConfig[] }>(`/admin/runtime-configs/${encodeURIComponent(key)}/history`);
}

export function updateRuntimeConfig(key: string, value: Record<string, unknown>, reason: string) {
  return adminRequest<RuntimeConfig>('/admin/runtime-configs', {
    method: 'PATCH',
    body: JSON.stringify({ key, value, reason }),
  });
}

export function rollbackRuntimeConfig(input: {
  key: string;
  expectedCurrentId: string;
  targetId: string;
  reason: string;
}) {
  return adminRequest<RuntimeConfig>('/admin/runtime-configs/rollback', {
    method: 'POST',
    body: JSON.stringify(input),
  });
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

export function listUserModerationActions(id: string, cursor?: string) {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);
  return adminRequest<CursorPage<UserModerationAction>>(`/admin/users/${id}/actions?${params.toString()}`);
}
