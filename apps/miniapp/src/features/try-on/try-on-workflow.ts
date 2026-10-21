import type {
  BodyProfile,
  BodyProfileVersion,
  ClothingItem,
  CreateGenerationInput,
  CursorPage,
  GenerationJob,
  QuotaSummary,
} from '@lumi/contracts';
import { ApiRequestError } from '../../services/api-request-error';

export type TryOnApi = {
  login(): Promise<void>;
  sessionEpoch(): number;
  profiles(cursor?: string): Promise<CursorPage<BodyProfile>>;
  profileVersions(profileId: string, cursor?: string): Promise<CursorPage<BodyProfileVersion>>;
  clothing(cursor?: string): Promise<CursorPage<ClothingItem>>;
  quota(): Promise<QuotaSummary>;
  create(input: CreateGenerationInput): Promise<GenerationJob>;
  read(id: string): Promise<GenerationJob>;
  retry(id: string): Promise<GenerationJob>;
  cancel(id: string): Promise<GenerationJob>;
  confirm(message: string): Promise<boolean>;
  key(): string;
};

export type TryOnSnapshot = {
  loaded: boolean;
  busy: boolean;
  profiles: BodyProfile[];
  clothing: ClothingItem[];
  profileCursor: string | null;
  profileHistoryCursor: string | null;
  profileHistoryId?: string;
  clothingCursor: string | null;
  profileVersionId?: string;
  clothingId?: string;
  quota?: QuotaSummary;
  job?: GenerationJob;
  pendingInput?: CreateGenerationInput;
  error?: string;
};

export function isActiveJob(job?: GenerationJob): boolean {
  return job?.status === 'QUEUED' || job?.status === 'RUNNING';
}

function initialState(): TryOnSnapshot {
  return {
    loaded: false,
    busy: false,
    profiles: [],
    clothing: [],
    profileCursor: null,
    profileHistoryCursor: null,
    clothingCursor: null,
  };
}

/** Platform-independent workflow. React renders snapshots; Taro owns dialogs and page lifecycle. */
export class TryOnWorkflow {
  private state = initialState();
  private readonly listeners = new Set<() => void>();
  private epoch: number;
  private action = 0;
  private jobRevision = 0;
  private quotaRevision = 0;
  constructor(private readonly api: TryOnApi) {
    this.epoch = api.sessionEpoch();
  }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  resetForSession() {
    if (this.epoch === this.api.sessionEpoch()) return;
    this.epoch = this.api.sessionEpoch();
    this.action += 1;
    this.jobRevision += 1;
    this.state = initialState();
    this.emit();
  }

  leave() {
    this.action += 1;
    this.jobRevision += 1;
    this.patch({ busy: false });
  }
  private emit() {
    for (const listener of this.listeners) listener();
  }
  private patch(change: Partial<TryOnSnapshot>) {
    this.state = { ...this.state, ...change };
    this.emit();
  }
  private valid(action: number) {
    return action === this.action && this.epoch === this.api.sessionEpoch();
  }
  private locked() {
    return this.state.busy || !!this.state.pendingInput || isActiveJob(this.state.job);
  }

  selectProfile(id: string) {
    if (this.locked()) return;
    if (!this.state.profiles.some((p) => p.versions.some((v) => v.id === id))) return;
    const selected = this.state.profiles.find((profile) => profile.versions.some((version) => version.id === id));
    this.patch({
      profileVersionId: id,
      profileHistoryCursor: selected?.id === this.state.profileHistoryId ? this.state.profileHistoryCursor : null,
      profileHistoryId: selected?.id,
      job: undefined,
      error: undefined,
    });
  }

  async loadProfileHistory() {
    this.resetForSession();
    if (this.locked()) return;
    const profile = this.state.profiles.find((item) =>
      item.versions.some((version) => version.id === this.state.profileVersionId),
    );
    if (!profile || profile.versions.length >= profile.activeVersion) return;
    const cursor = this.state.profileHistoryId === profile.id ? this.state.profileHistoryCursor : null;
    const action = ++this.action;
    this.patch({ busy: true, error: undefined, profileHistoryId: profile.id });
    try {
      const page = await this.api.profileVersions(profile.id, cursor ?? undefined);
      if (!this.valid(action)) return;
      this.patch({
        profiles: this.state.profiles.map((item) =>
          item.id === profile.id
            ? {
                ...item,
                versions: this.merge(item.versions, page.items).sort((left, right) => right.version - left.version),
              }
            : item,
        ),
        profileHistoryCursor: page.nextCursor,
      });
    } catch (error) {
      if (this.valid(action)) this.patch({ error: this.message(error) });
    } finally {
      if (this.valid(action)) this.patch({ busy: false });
    }
  }
  selectClothing(id: string) {
    if (this.locked() || !this.state.clothing.some((c) => c.id === id)) return;
    this.patch({ clothingId: id, job: undefined, error: undefined });
  }

  async prepare() {
    this.resetForSession();
    if (this.locked()) return;
    const action = ++this.action;
    this.patch({ busy: true, error: undefined });
    try {
      await this.api.login();
      if (action !== this.action) return;
      if (this.epoch !== this.api.sessionEpoch()) {
        this.epoch = this.api.sessionEpoch();
        this.state = initialState();
      }
      const [profiles, clothing, quota] = await Promise.all([
        this.api.profiles(),
        this.api.clothing(),
        this.api.quota(),
      ]);
      if (!this.valid(action)) return;
      this.patch({
        loaded: true,
        profiles: profiles.items,
        clothing: clothing.items,
        profileCursor: profiles.nextCursor,
        clothingCursor: clothing.nextCursor,
        quota,
        profileVersionId: profiles.items.some((p) => p.versions.some((v) => v.id === this.state.profileVersionId))
          ? this.state.profileVersionId
          : undefined,
        clothingId: clothing.items.some((c) => c.id === this.state.clothingId) ? this.state.clothingId : undefined,
      });
    } catch (error) {
      if (this.valid(action)) this.patch({ error: this.message(error) });
    } finally {
      if (this.valid(action)) this.patch({ busy: false });
    }
  }

  async more(kind: 'profiles' | 'clothing') {
    this.resetForSession();
    if (this.locked()) return;
    const cursor = kind === 'profiles' ? this.state.profileCursor : this.state.clothingCursor;
    if (!cursor) return;
    const action = ++this.action;
    this.patch({ busy: true, error: undefined });
    try {
      if (kind === 'profiles') {
        const page = await this.api.profiles(cursor);
        if (this.valid(action))
          this.patch({ profiles: this.merge(this.state.profiles, page.items), profileCursor: page.nextCursor });
      } else {
        const page = await this.api.clothing(cursor);
        if (this.valid(action))
          this.patch({ clothing: this.merge(this.state.clothing, page.items), clothingCursor: page.nextCursor });
      }
    } catch (error) {
      if (this.valid(action)) this.patch({ error: this.message(error) });
    } finally {
      if (this.valid(action)) this.patch({ busy: false });
    }
  }

  async start() {
    this.resetForSession();
    if (this.state.busy || isActiveJob(this.state.job)) return;
    const profile = this.state.profiles.find((p) => p.versions.some((v) => v.id === this.state.profileVersionId));
    const version = profile?.versions.find((v) => v.id === this.state.profileVersionId);
    const clothing = this.state.clothing.find((c) => c.id === this.state.clothingId);
    if (!version?.sourceAssetId || !clothing?.assetId) {
      this.patch({ error: '请明确选择带人物照的档案版本和带图片的衣物；缺少图片时先完善资料。' });
      return;
    }
    await this.mutate(async (valid) => {
      const quota = await this.api.quota();
      if (!valid()) return;
      this.patch({ quota });
      if (!this.state.pendingInput) {
        if (quota.available < quota.costPerGeneration) throw new Error('免费体验额度不足，仍可查询或取消已有任务。');
        if (
          !(await this.api.confirm(
            '人物：' +
              profile!.name +
              ' v' +
              version.version +
              '；衣物：' +
              clothing.name +
              '。本次预留 ' +
              quota.costPerGeneration +
              ' 次，成功才消耗，失败/取消返还。当前仅为本地预览，不是真实 AI。',
          ))
        )
          return;
        if (!valid()) return;
        this.patch({
          pendingInput: { profileVersionId: version.id, clothingAssetId: clothing.id, idempotencyKey: this.api.key() },
        });
      }
      try {
        return await this.api.create(this.state.pendingInput!);
      } catch (error) {
        if (
          valid() &&
          error instanceof ApiRequestError &&
          ([400, 404].includes(error.statusCode) || error.code === 'FREE_QUOTA_EXHAUSTED')
        )
          this.patch({ pendingInput: undefined });
        throw error;
      }
    });
  }

  async retry() {
    this.resetForSession();
    const job = this.state.job;
    if (this.state.busy || !job || !['FAILED', 'DEAD_LETTER'].includes(job.status)) return;
    await this.mutate(async (valid) => {
      const quota = await this.api.quota();
      if (!valid()) return;
      this.patch({ quota });
      if (quota.available < quota.costPerGeneration) throw new Error('免费体验额度不足，未启动重试。');
      if (
        !(await this.api.confirm(
          '使用原任务的输入快照重新生成，预留 ' + quota.costPerGeneration + ' 次；成功消耗，失败返还。',
        ))
      )
        return;
      if (!valid()) return;
      return this.api.retry(job.id);
    });
  }

  async cancel() {
    this.resetForSession();
    const job = this.state.job;
    if (this.state.busy || !isActiveJob(job)) return;
    await this.mutate(() => this.api.cancel(job!.id));
  }

  async refreshJob() {
    this.resetForSession();
    const job = this.state.job;
    if (this.state.busy || !job) return;
    const revision = ++this.jobRevision;
    const epoch = this.epoch;
    try {
      const result = await this.api.read(job.id);
      if (revision !== this.jobRevision || epoch !== this.api.sessionEpoch()) return;
      this.accept(result);
      await this.refreshQuota();
    } catch (error) {
      if (revision === this.jobRevision && epoch === this.api.sessionEpoch())
        this.patch({ error: this.message(error) });
    }
  }

  private async mutate(work: (valid: () => boolean) => Promise<GenerationJob | undefined>) {
    const action = ++this.action;
    this.jobRevision += 1;
    this.patch({ busy: true, error: undefined });
    try {
      const result = await work(() => this.valid(action));
      if (this.valid(action) && result) this.accept(result);
    } catch (error) {
      if (this.valid(action)) this.patch({ error: this.message(error) });
    } finally {
      if (this.valid(action)) {
        this.patch({ busy: false });
        await this.refreshQuota();
      }
    }
  }
  private accept(job: GenerationJob) {
    this.patch({ job, error: undefined, ...(isActiveJob(job) ? {} : { pendingInput: undefined }) });
  }
  private async refreshQuota() {
    const epoch = this.epoch;
    const revision = ++this.quotaRevision;
    const action = this.action;
    try {
      const quota = await this.api.quota();
      if (epoch === this.api.sessionEpoch() && revision === this.quotaRevision && action === this.action)
        this.patch({ quota });
    } catch {
      /* Preserve the task result; the next explicit query retries quota. */
    }
  }
  private merge<T extends { id: string }>(old: T[], added: T[]): T[] {
    const map = new Map(old.map((x) => [x.id, x]));
    for (const item of added) map.set(item.id, item);
    return [...map.values()];
  }
  private message(error: unknown) {
    return error instanceof Error ? error.message : '网络暂时不可用，请保留输入后重试。';
  }
}
