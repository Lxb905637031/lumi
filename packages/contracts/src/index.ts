export const API_PREFIX = '/api/v1' as const;

export const generationJobStatuses = [
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
] as const;

export type GenerationJobStatus = (typeof generationJobStatuses)[number];

export type HealthResponse = {
  status: 'ok';
  service: 'lumi-api';
  version: string;
  timestamp: string;
};

export type ApiError = {
  code: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};
