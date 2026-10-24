export const API_PREFIX = '/api/v1' as const;

export const generationJobStatuses = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER', 'CANCELLED'] as const;

export type GenerationJobStatus = (typeof generationJobStatuses)[number];

export type HealthResponse = {
  status: 'ok';
  service: 'lumi-api';
  version: string;
  timestamp: string;
};

export type ApiMeta = { requestId: string; timestamp: string };

export type ApiSuccess<T> = {
  success: true;
  code: 'OK';
  message: 'OK';
  data: T;
  meta: ApiMeta;
};

export type ApiError = {
  success: false;
  code: string;
  message: string;
  details?: unknown;
  meta: ApiMeta;
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

export type AccountDeletionStatus = 'REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

export type AccountDeletionRequest = {
  id: string;
  status: AccountDeletionStatus;
  requestedAt: string;
  scheduledFor: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  failureCode: string | null;
};

export type DataExportStatus = 'REQUESTED' | 'PROCESSING' | 'READY' | 'EXPIRED' | 'FAILED';

export type DataExportRequest = {
  id: string;
  status: DataExportStatus;
  requestedAt: string;
  processingAt: string | null;
  readyAt: string | null;
  expiresAt: string | null;
  failureCode: string | null;
};

export const userRoles = ['USER', 'MODERATOR', 'ADMIN'] as const;
export type UserRole = (typeof userRoles)[number];

export const userStatuses = ['ACTIVE', 'SUSPENDED', 'DELETED'] as const;
export type UserStatus = (typeof userStatuses)[number];

export type AdminUser = {
  id: string;
  status: UserStatus;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  postCount: number;
  reportCount: number;
  activeMute: UserMuteSummary | null;
};

export type UserMuteSummary = {
  id: string;
  reason: string;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
};

export type AdminMediaAsset = {
  id: string;
  ownerId: string;
  kind: 'PROFILE' | 'CLOTHING' | 'GENERATION_OUTPUT' | 'UPLOAD';
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'REJECTED' | 'EXPIRED' | 'DELETED';
  reviewStatus: 'UNREVIEWED' | 'APPROVED' | 'REJECTED';
  reviewReason: string | null;
  reviewedAt: string | null;
  reviewedById: string | null;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  url: string | null;
  createdAt: string;
  updatedAt: string;
};

export const moderationStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'REMOVED'] as const;
export type ModerationStatus = (typeof moderationStatuses)[number];

export const reportStatuses = ['OPEN', 'RESOLVED', 'REJECTED'] as const;
export type ReportStatus = (typeof reportStatuses)[number];

export type ModerationQueueItem = {
  id: string;
  title: string;
  bodyPreview: string;
  submittedBy: string;
  status: ModerationStatus;
  createdAt: string;
  updatedAt: string;
};

export type ReportQueueItem = {
  id: string;
  postId: string;
  postTitle: string;
  postPreview: string;
  reporterId: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolutionReason: string | null;
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

export type BodyProfileVersionPage = CursorPage<BodyProfileVersion>;

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
  challengeId: string | null;
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
  idempotencyKey: string;
  title: string;
  body: string;
  imageAssetIds: string[];
  topic?: string;
  challengeSlug?: string;
  isAiGenerated?: boolean;
};

export type CommunityChallenge = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
  startsAt: string;
  endsAt: string;
  participantCount: number;
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
  type: 'SYSTEM' | 'MODERATION' | 'GENERATION' | 'FOLLOW' | 'INTERACTION';
  title: string;
  body: string;
  targetType: string | null;
  targetId: string | null;
  commentId?: string | null;
  readAt: string | null;
  createdAt: string;
};

export type CommunityUser = {
  id: string;
  displayName: string;
  followed: boolean;
  createdAt: string;
};

export type NotificationDestination =
  | { kind: 'POST'; id: string; commentId: string | null; notice: string | null }
  | { kind: 'GENERATION_JOB'; id: string }
  | { kind: 'FOLLOWERS' }
  | { kind: 'ANNOUNCEMENT'; title: string; body: string }
  | { kind: 'UNAVAILABLE'; message: string };

export type AnnouncementStatus = 'DRAFT' | 'SENDING' | 'SENT';

export type Announcement = {
  id: string;
  title: string;
  body: string;
  status: AnnouncementStatus;
  version: number;
  recipientCount: number | null;
  deliveredCount: number;
  createdAt: string;
  publishedAt: string | null;
  sentAt: string | null;
};

export type CreateAnnouncementInput = { idempotencyKey: string; title: string; body: string };

export type UpdateAnnouncementInput = { expectedVersion: number; title: string; body: string };

export type PublishAnnouncementInput = { expectedVersion: number };

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
  savedAt: string | null;
  createdAt: string;
};

export type GenerationShare = {
  id: string;
  token: string;
  outputId: string;
  assetId: string;
  url: string;
  mimeType: string;
  expiresAt: string;
  developmentPreview: boolean;
};

export type CreateGenerationInput = {
  profileVersionId: string;
  clothingAssetId: string;
  idempotencyKey: string;
};

export type QuotaSummary = {
  available: number;
  reserved: number;
  consumed: number;
  granted: number;
  policyVersion: string;
  costPerGeneration: number;
};

export type QuotaLedgerEntry = {
  id: string;
  type: 'GRANT' | 'RESERVE' | 'COMMIT' | 'RELEASE';
  jobId: string | null;
  attempt: number | null;
  deltaAvailable: number;
  deltaReserved: number;
  deltaConsumed: number;
  createdAt: string;
};
