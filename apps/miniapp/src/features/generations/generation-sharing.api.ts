import type { GenerationShare } from '@lumi/contracts';
import { request } from '../../services/http-client';

export function createGenerationShare(jobId: string, outputId: string): Promise<GenerationShare> {
  return request(`/generation-jobs/${encodeURIComponent(jobId)}/outputs/${encodeURIComponent(outputId)}/shares`, {
    method: 'POST',
    data: {},
  });
}

export function getGenerationShare(token: string): Promise<GenerationShare> {
  return request('/generation-shares/resolve', { method: 'POST', data: { token } });
}

export function revokeGenerationShare(shareId: string) {
  return request<{ revoked: boolean }>(`/generation-shares/${encodeURIComponent(shareId)}`, { method: 'DELETE' });
}
