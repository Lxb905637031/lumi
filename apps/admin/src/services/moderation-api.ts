import type { CursorPage, ModerationQueueItem, ModerationStatus } from '@lumi/contracts';

const apiUrl = (import.meta.env.VITE_LUMI_API_URL ?? 'http://localhost:4300/api/v1').replace(/\/$/, '');
const accessToken = import.meta.env.VITE_LUMI_ADMIN_ACCESS_TOKEN?.trim() ?? '';

export const moderationApiConfig = {
  enabled: Boolean(accessToken),
  apiUrl,
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json()) as T | { message?: string };
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'message' in body ? body.message : undefined;
    throw new Error(message || `审核接口请求失败（${response.status}）`);
  }
  return body as T;
}

export function listModerationPosts(): Promise<CursorPage<ModerationQueueItem>> {
  return request<CursorPage<ModerationQueueItem>>('/admin/moderation/posts?limit=20');
}

export function updateModerationStatus(
  postId: string,
  status: Exclude<ModerationStatus, 'PENDING'>,
): Promise<ModerationQueueItem> {
  return request<ModerationQueueItem>(`/admin/moderation/posts/${postId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
