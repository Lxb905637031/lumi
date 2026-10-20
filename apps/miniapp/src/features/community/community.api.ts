import type {
  CommunityChallenge,
  CommunityComment,
  CommunityPost,
  CreateCommunityPostInput,
  CursorPage,
} from '@lumi/contracts';
import { request } from '../../services/http-client';

export function listCommunityPosts(
  cursor?: string,
  search?: string,
  topic?: string,
): Promise<CursorPage<CommunityPost>> {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);
  if (search?.trim()) params.set('search', search.trim());
  if (topic) params.set('topic', topic);
  return request(`/community/posts?${params.toString()}`);
}

export function listCommunityTopics(search?: string): Promise<{ items: string[] }> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return request(`/community/topics${query}`);
}

export function listChallenges(): Promise<CommunityChallenge[]> {
  return request('/challenges');
}

export function getChallengeParticipation(slug: string): Promise<{ active: boolean; joinedAt: string | null }> {
  return request(`/challenges/${encodeURIComponent(slug)}/participation`);
}

export function setChallengeParticipation(slug: string, active: boolean) {
  return request<{ active: boolean; joinedAt: string | null }>(
    `/challenges/${encodeURIComponent(slug)}/participation`,
    {
      method: 'PUT',
      data: { active },
    },
  );
}

export function createCommunityPost(input: CreateCommunityPostInput): Promise<CommunityPost> {
  return request('/community/posts', { method: 'POST', data: input });
}

export function setPostLike(id: string, active: boolean) {
  return request<{ liked: boolean }>(`/community/posts/${id}/like`, { method: 'POST', data: { active } });
}

export function setPostBookmark(id: string, active: boolean) {
  return request<{ bookmarked: boolean }>(`/community/posts/${id}/bookmark`, { method: 'POST', data: { active } });
}

export function getPost(id: string): Promise<CommunityPost> {
  return request(`/community/posts/${id}`);
}
export function getPostComment(id: string, commentId: string): Promise<CommunityComment> {
  return request(`/community/posts/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`);
}
export function getPostState(id: string): Promise<{ liked: boolean; bookmarked: boolean }> {
  return request(`/community/posts/${id}/state`);
}
export function listComments(id: string, cursor?: string): Promise<CursorPage<CommunityComment>> {
  return request(`/community/posts/${id}/comments?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
}
export function listMyPosts(cursor?: string): Promise<CursorPage<CommunityPost>> {
  return request(`/community/me/posts?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
}
export function listBookmarks(cursor?: string): Promise<CursorPage<CommunityPost>> {
  return request(`/community/me/bookmarks?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
}
export function removePost(id: string) {
  return request(`/community/posts/${id}`, { method: 'DELETE' });
}
export function reportPost(id: string, reason: string) {
  return request(`/community/posts/${id}/reports`, { method: 'POST', data: { reason } });
}

export function addPostComment(id: string, body: string): Promise<CommunityComment> {
  return request(`/community/posts/${id}/comments`, { method: 'POST', data: { body } });
}
