import type { CommunityPost, CreateCommunityPostInput } from '@lumi/contracts';
import { ApiRequestError } from '../../services/api-request-error';
import type { MediaUploadProgress } from '../media/media.api';

export type PostSource = { jobId: string; outputId: string };
export type DraftAsset = { id: string; preview: string };
export type PostDraft = { title: string; body: string; topic: string; assets: DraftAsset[] };
export type ComposerState = {
  ready: boolean;
  busy: boolean;
  draft: PostDraft;
  pending?: CreateCommunityPostInput;
  post?: CommunityPost;
  error?: string;
  remainingUploads: number;
  uploadProgress?: MediaUploadProgress;
};
export type ComposerApi = {
  login: () => Promise<void>;
  sessionEpoch: () => number;
  key: () => string;
  choose: (count: number) => Promise<string[]>;
  upload: (path: string, onProgress?: (progress: MediaUploadProgress) => void) => Promise<DraftAsset>;
  source: (source: PostSource) => Promise<DraftAsset>;
  confirm: () => Promise<boolean>;
  create: (input: CreateCommunityPostInput) => Promise<CommunityPost>;
};
const initial = (): ComposerState => ({
  ready: false,
  busy: false,
  draft: { title: '', body: '', topic: '', assets: [] },
  remainingUploads: 0,
});

/** Platform-independent publication use case. All private context is session-local memory. */
export class PostComposerWorkflow {
  private state = initial();
  private epoch: number;
  private version = 0;
  private active = true;
  private uploadPaths: string[] = [];
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly api: ComposerApi,
    readonly source?: PostSource,
  ) {
    this.epoch = api.sessionEpoch();
  }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private patch(patch: Partial<ComposerState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  private syncSession() {
    if (this.epoch === this.api.sessionEpoch()) return true;
    this.epoch = this.api.sessionEpoch();
    this.version += 1;
    this.uploadPaths = [];
    this.state = initial();
    this.patch({});
    return false;
  }
  resume() {
    this.active = true;
    this.syncSession();
  }
  leave() {
    this.active = false;
    this.version += 1;
    this.patch({ busy: false, uploadProgress: undefined });
  }
  private begin() {
    if (!this.syncSession() || !this.active || this.state.busy) return null;
    const version = ++this.version;
    this.patch({ busy: true, error: undefined, uploadProgress: undefined });
    return () => {
      if (!this.syncSession()) return false;
      return this.active && version === this.version;
    };
  }
  edit(patch: Partial<Pick<PostDraft, 'title' | 'body' | 'topic'>>) {
    if (!this.syncSession() || !this.state.ready || this.state.busy || this.state.pending || this.state.post) return;
    this.patch({ draft: { ...this.state.draft, ...patch } });
  }
  removeAsset(id: string) {
    if (!this.syncSession() || this.source || this.state.busy || this.state.pending || this.state.post) return;
    this.patch({ draft: { ...this.state.draft, assets: this.state.draft.assets.filter((asset) => asset.id !== id) } });
  }
  async prepare() {
    this.syncSession();
    if (this.state.ready || this.state.pending || this.state.post) return;
    // Only this explicit user action may trigger authentication.
    this.syncSession();
    const valid = this.begin();
    if (!valid) return;
    try {
      await this.api.login();
      // First login may establish a new session. No editable draft exists before prepare succeeds.
      if (this.epoch !== this.api.sessionEpoch()) {
        this.epoch = this.api.sessionEpoch();
        this.uploadPaths = [];
        this.patch({ ...initial(), busy: true });
      }
      if (!valid()) return;
      if (this.source) {
        const asset = await this.api.source(this.source);
        if (!valid()) return;
        this.patch({ draft: { ...this.state.draft, assets: [asset] } });
      }
      this.patch({ ready: true });
    } catch (reason) {
      if (valid()) this.patch({ error: reason instanceof Error ? reason.message : '草稿准备失败，请重试' });
    } finally {
      if (valid()) this.patch({ busy: false, uploadProgress: undefined });
    }
  }
  async addImages() {
    if (
      this.source ||
      !this.state.ready ||
      this.state.pending ||
      this.state.post ||
      this.state.draft.assets.length >= 9
    )
      return;
    const valid = this.begin();
    if (!valid) return;
    try {
      if (!this.uploadPaths.length) {
        const paths = await this.api.choose(9 - this.state.draft.assets.length);
        if (!valid()) return;
        this.uploadPaths = paths.slice(0, 9 - this.state.draft.assets.length);
        this.patch({ remainingUploads: this.uploadPaths.length });
      }
      while (this.uploadPaths.length && this.state.draft.assets.length < 9) {
        const asset = await this.api.upload(this.uploadPaths[0]!, (uploadProgress) => {
          if (valid()) this.patch({ uploadProgress });
        });
        if (!valid()) return;
        this.uploadPaths.shift();
        const assets = this.state.draft.assets.some((item) => item.id === asset.id)
          ? this.state.draft.assets
          : [...this.state.draft.assets, asset];
        this.patch({
          draft: { ...this.state.draft, assets },
          remainingUploads: this.uploadPaths.length,
          uploadProgress: undefined,
        });
      }
    } catch (reason) {
      if (valid())
        this.patch({
          error: reason instanceof Error ? reason.message : '图片上传失败，可重试剩余文件',
          remainingUploads: this.uploadPaths.length,
        });
    } finally {
      if (valid()) this.patch({ busy: false, uploadProgress: undefined });
    }
  }
  async submit() {
    if (!this.state.ready || this.state.post) return;
    const valid = this.begin();
    if (!valid) return;
    const recovering = !!this.state.pending;
    try {
      if (!this.state.pending) {
        const draft = this.state.draft;
        if (!draft.title.trim() || !draft.body.trim() || !draft.assets.length || this.uploadPaths.length)
          throw new Error('请填写标题、正文并完成 1—9 张图片上传');
        if (this.source) {
          const asset = await this.api.source(this.source);
          if (!valid()) return;
          if (asset.id !== draft.assets[0]?.id) throw new Error('生成结果已变化，请返回记录重新确认');
        }
        if (!(await this.api.confirm()) || !valid()) return;
        this.patch({
          pending: {
            idempotencyKey: this.api.key(),
            title: draft.title.trim(),
            body: draft.body.trim(),
            topic: draft.topic.trim() || undefined,
            imageAssetIds: draft.assets.map((asset) => asset.id),
            ...(this.source ? { isAiGenerated: true } : {}),
          },
        });
      }
      // This immutable intent survives unknown responses and page hiding. Never mutate the caller's object.
      const input = { ...this.state.pending!, imageAssetIds: [...this.state.pending!.imageAssetIds] };
      try {
        const post = await this.api.create(input);
        if (valid()) this.patch({ post, pending: undefined, draft: initial().draft });
      } catch (reason) {
        if (valid()) {
          const definitive =
            reason instanceof ApiRequestError && [400, 401, 403, 404, 409, 422, 429].includes(reason.statusCode);
          if (definitive && !recovering) this.patch({ pending: undefined });
          throw reason;
        }
      }
    } catch (reason) {
      if (valid())
        this.patch({ error: reason instanceof Error ? reason.message : '发布结果未知，可继续原发布或查看我的帖子' });
    } finally {
      if (valid()) this.patch({ busy: false });
    }
  }
  newDraft() {
    if (!this.syncSession() || !this.state.post || this.state.busy) return;
    this.uploadPaths = [];
    this.patch({ ...initial(), post: undefined, pending: undefined, error: undefined });
  }
}
