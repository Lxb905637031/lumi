import type { BodyProfile, CreateBodyProfileInput, CreateBodyProfileResponse, CursorPage } from '@lumi/contracts';
import { request } from '../../services/http-client';

export function listBodyProfiles(): Promise<BodyProfile[]> {
  return request<CursorPage<BodyProfile>>('/body-profiles').then((page) => page.items);
}

export function createBodyProfile(input: CreateBodyProfileInput): Promise<CreateBodyProfileResponse> {
  return request('/body-profiles', { method: 'POST', data: input });
}
