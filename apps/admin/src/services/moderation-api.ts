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
