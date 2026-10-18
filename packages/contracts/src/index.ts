export const API_PREFIX = '/api/v1' as const;

export const generationJobStatuses = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'] as const;

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

export type AuthSession = {
  accessToken: string;
  user: { id: string; openId: string };
  freeMode: boolean;
};

export type BodyProfileVersion = {
  id: string;
  profileId: string;
  version: number;
  measurements: { heightCm: number | null; weightKg: number | null };
  createdAt: string;
};

export type BodyProfile = {
  id: string;
  userId: string;
  name: string;
  activeVersion: number;
  versions: BodyProfileVersion[];
  createdAt: string;
  updatedAt: string;
};

export type CreateBodyProfileInput = {
  name: string;
  heightCm?: number;
  weightKg?: number;
};

export type CreateBodyProfileResponse = BodyProfileVersion & {
  profile: BodyProfile;
};

export type ClothingItem = {
  id: string;
  userId: string;
  name: string;
  category: 'TOP' | 'BOTTOM' | 'DRESS';
  assetId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateClothingInput = {
  name: string;
  category: ClothingItem['category'];
  assetId?: string;
};

export type GenerationJob = {
  id: string;
  status: GenerationJobStatus;
  provider: string;
};

export type CreateGenerationInput = {
  profileVersionId: string;
  clothingAssetId: string;
  idempotencyKey: string;
};
