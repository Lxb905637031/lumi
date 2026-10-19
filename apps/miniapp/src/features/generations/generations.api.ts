import type { CreateGenerationInput, GenerationJob } from '@lumi/contracts';
import { request } from '../../services/http-client';

export function createGeneration(input: CreateGenerationInput): Promise<GenerationJob> {
  return request('/generation-jobs', { method: 'POST', data: input });
}

export function getGeneration(id: string): Promise<GenerationJob> {
  return request(`/generation-jobs/${id}`);
}

export function retryGeneration(id: string): Promise<GenerationJob> {
  return request(`/generation-jobs/${id}/retry`, { method: 'POST', data: {} });
}

export function cancelGeneration(id: string): Promise<GenerationJob> {
  return request(`/generation-jobs/${id}/cancel`, { method: 'POST', data: {} });
}
