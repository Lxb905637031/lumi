export const API_PREFIX = '/api/v1' as const;

export const generationJobStatuses = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER', 'CANCELLED'] as const;

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
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: { id: string; openId: string; role: UserRole };
  freeMode: boolean;
};

export const userRoles = ['USER', 'MODERATOR', 'ADMIN'] as const;
export type UserRole = (typeof userRoles)[number];

export const moderationStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'REMOVED'] as const;
export type ModerationStatus = (typeof moderationStatuses)[number];

export type ModerationQueueItem = {
  id: string;
  title: string;
  bodyPreview: string;
  submittedBy: string;
  status: ModerationStatus;
  createdAt: string;
  updatedAt: string;
};

export type BodyProfileVersion = {
  id: string;
  profileId: string;
  sourceAssetId: string | null;
  version: number;
  measurements: {
    heightCm: number | null;
    weightKg: number | null;
    shoulderCm?: number | null;
    bustCm?: number | null;
    waistCm?: number | null;
    hipCm?: number | null;
  };
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
  shoulderCm?: number;
  bustCm?: number;
  waistCm?: number;
  hipCm?: number;
  sourceAssetId?: string;
};

export type CreateBodyProfileResponse = BodyProfileVersion & {
  profile: BodyProfile;
};

export type ClothingItem = {
  id: string;
  userId: string;
  name: string;
  category: 'TOP' | 'BOTTOM' | 'DRESS';
  color?: string | null;
  style?: string | null;
  assetId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateClothingInput = {
  name: string;
  category: ClothingItem['category'];
  assetId?: string;
  color?: string;
  style?: string;
};

export type MediaAsset = {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'REJECTED' | 'EXPIRED' | 'DELETED';
  storageDriver: string;
  mimeType: string;
  byteSize: number;
  visibility: string;
  previewData: string | null;
  url: string | null;
  urlExpiresAt: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};

export type SystemBootstrap = {
  freeMode: boolean;
  media: { uploadMode: 'signed-post' | 'development-base64'; maxBytes: number };
  features: { generation: boolean; payments: boolean; community: boolean; follows: boolean };
};

export type ReserveMediaUploadInput = {
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  byteSize: number;
  idempotencyKey: string;
};

export type MediaUploadReservation = {
  assetId: string;
  status: MediaAsset['status'];
  expiresAt: string | null;
  upload: { url: string; fields: Record<string, string> } | null;
};

export type CreateMediaAssetInput = {
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64: string;
};

export type CommunityPost = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  topic: string | null;
  imageAssetIds: string[];
  imagePreviews: string[];
  isAiGenerated: boolean;
  moderationStatus: ModerationStatus;
  featuredAt: string | null;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  liked: boolean;
  bookmarked: boolean;
};

export type CreateCommunityPostInput = {
  title: string;
  body: string;
  imageAssetIds?: string[];
  topic?: string;
  isAiGenerated?: boolean;
};

export type CommunityComment = {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type CreateCommentInput = { body: string };

export type Notification = {
  id: string;
  type: 'SYSTEM' | 'MODERATION' | 'GENERATION';
  title: string;
  body: string;
  targetType: string | null;
  targetId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type GenerationJob = {
  id: string;
  status: GenerationJobStatus;
  provider: string;
  retryCount: number;
  errorCode: string | null;
  nextAttemptAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  outputs: GenerationOutput[];
};

export type GenerationOutput = {
  id: string;
  assetId: string;
  mimeType: string;
  byteSize: number;
  visibility: string;
  previewData: string | null;
  selectedAt: string | null;
  createdAt: string;
};

export type CreateGenerationInput = {
  profileVersionId: string;
  clothingAssetId: string;
  idempotencyKey: string;
};
