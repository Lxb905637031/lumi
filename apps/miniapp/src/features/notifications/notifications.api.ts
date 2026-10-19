import type { CursorPage, Notification } from '@lumi/contracts';
import { request } from '../../services/http-client';

export function listNotifications(cursor?: string): Promise<CursorPage<Notification>> {
  return request('/notifications?limit=30' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
}

export function markNotificationRead(id: string) {
  return request('/notifications/' + id + '/read', { method: 'PATCH', data: {} });
}

export function getUnreadNotificationCount(): Promise<{ count: number }> {
  return request('/notifications/unread-count');
}

export function markAllNotificationsRead() {
  return request('/notifications/read-all', { method: 'PATCH', data: {} });
}
