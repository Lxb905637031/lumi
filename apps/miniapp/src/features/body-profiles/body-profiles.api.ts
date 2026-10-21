import type {
  BodyProfile,
  BodyProfileVersionPage,
  CreateBodyProfileInput,
  CreateBodyProfileResponse,
  CursorPage,
} from '@lumi/contracts';
import { request } from '../../services/http-client';

export function listBodyProfiles(): Promise<BodyProfile[]> {
  return request<CursorPage<BodyProfile>>('/body-profiles').then((page) => page.items);
}

export function listBodyProfilePage(cursor?: string): Promise<CursorPage<BodyProfile>> {
  return request('/body-profiles?limit=20' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
}

export function listBodyProfileVersions(profileId: string, cursor?: string): Promise<BodyProfileVersionPage> {
  return request(
    `/body-profiles/${encodeURIComponent(profileId)}/versions?limit=20` +
      (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
  );
}

export function createBodyProfile(input: CreateBodyProfileInput): Promise<CreateBodyProfileResponse> {
  return request('/body-profiles', { method: 'POST', data: input });
}

export function updateBodyProfile(
  id: string,
  input: CreateBodyProfileInput & { expectedVersion: number },
): Promise<CreateBodyProfileResponse> {
  return request(`/body-profiles/${id}`, { method: 'PATCH', data: input });
}

export function archiveBodyProfile(id: string) {
  return request(`/body-profiles/${id}`, { method: 'DELETE' });
}
