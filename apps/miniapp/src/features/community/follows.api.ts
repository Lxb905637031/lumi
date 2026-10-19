import type { CommunityUser, CursorPage } from '@lumi/contracts';
import { request } from '../../services/http-client';

export function getFollowState(userId: string): Promise<{ following: boolean }> {
  return request(`/community/users/${encodeURIComponent(userId)}/follow-state`);
}
export function setFollow(userId: string, active: boolean): Promise<{ following: boolean }> {
  return request(`/community/users/${encodeURIComponent(userId)}/follow`, { method: 'PUT', data: { active } });
}
export function listFollowers(cursor?: string): Promise<CursorPage<CommunityUser>> {
  return request(`/community/me/followers?limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
}
export function listFollowing(cursor?: string): Promise<CursorPage<CommunityUser>> {
  return request(`/community/me/following?limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
}
