import { useCallback, useEffect, useState } from 'react';
import type { AdminMediaAsset } from '@lumi/contracts';
import {
  listMediaModeration,
  updateMediaModerationStatus,
  updateMediaModerationStatuses,
  type MediaReviewKind,
  type MediaReviewStatus,
} from '../../services/moderation-api';

const kindLabels: Record<MediaReviewKind, string> = {
  PROFILE: '人物资料',
  CLOTHING: '衣物素材',
  GENERATION_OUTPUT: '生成结果',
  UPLOAD: '未关联素材',
};

const statusLabels: Record<MediaReviewStatus, string> = {
  UNREVIEWED: '待审核',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
};

export function MediaReviewQueue() {
  const [items, setItems] = useState<AdminMediaAsset[]>([]);
  const [status, setStatus] = useState<MediaReviewStatus>('UNREVIEWED');
  const [kind, setKind] = useState<MediaReviewKind>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (cursor?: string, append = false) => {
      setLoading(true);
      setError(undefined);
      try {
        const page = await listMediaModeration(status, kind, cursor);
        setItems((current) => (append ? [...current, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
        if (!append) setSelectedIds(new Set());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '图片审核队列读取失败');
      } finally {
        setLoading(false);
      }
    },
    [kind, status],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (item: AdminMediaAsset, next: 'APPROVED' | 'REJECTED') => {
    const reason = window.prompt(next === 'REJECTED' ? '拒绝原因（必填）' : '通过说明（可留空）', '');
    if (reason === null || (next === 'REJECTED' && !reason.trim())) return;
    setBusyId(item.id);
    setError(undefined);
    try {
      const updated = await updateMediaModerationStatus(item.id, next, item.updatedAt, reason);
      setItems((current) => current.map((row) => (row.id === item.id ? updated : row)));
      setSelectedIds((current) => {
        const nextIds = new Set(current);
        nextIds.delete(item.id);
        return nextIds;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '图片审核状态未确认，请刷新队列核对');
    } finally {
      setBusyId(undefined);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((current) =>
      items.length > 0 && items.every((item) => current.has(item.id))
        ? new Set()
        : new Set(items.filter((item) => item.reviewStatus === 'UNREVIEWED').map((item) => item.id)),
    );
  };

  const batchDecide = async (nextStatus: 'APPROVED' | 'REJECTED') => {
    const selected = items.filter((item) => selectedIds.has(item.id));
    if (!selected.length) return;
    const reason = window.prompt(nextStatus === 'REJECTED' ? '批量拒绝原因（必填）' : '批量通过说明（可留空）', '');
    if (reason === null || (nextStatus === 'REJECTED' && !reason.trim())) return;
    setBusyId('batch');
    setError(undefined);
    try {
      const result = await updateMediaModerationStatuses(
        selected.map((item) => ({ id: item.id, expectedUpdatedAt: item.updatedAt })),
        nextStatus,
        reason,
      );
      const updatedById = new Map(result.items.map((item) => [item.id, item]));
      setItems((current) => current.map((item) => updatedById.get(item.id) ?? item));
      setSelectedIds(new Set());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '批量图片审核失败，请刷新队列核对');
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <section className="mt-6 border-t border-lumi-line pt-6" aria-labelledby="media-review-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="media-review-title" className="text-xl font-semibold">
            图片审核
          </h2>
          <p className="mt-1 text-sm text-lumi-muted">人物、衣物和生成结果独立于帖子审核；私有素材不会自动公开。</p>
        </div>
        <button className="border border-lumi-line px-3 py-2 text-sm" onClick={() => void load()} disabled={loading}>
          刷新
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(statusLabels) as MediaReviewStatus[]).map((value) => (
          <button
            key={value}
            className={`border px-3 py-2 text-xs ${status === value ? 'border-lumi-ink bg-lumi-ink text-white' : 'border-lumi-line'}`}
            onClick={() => {
              setSelectedIds(new Set());
              setStatus(value);
            }}
          >
            {statusLabels[value]}
          </button>
        ))}
        <select
          className="border border-lumi-line bg-white px-3 py-2 text-xs"
          aria-label="按图片用途筛选"
          value={kind ?? ''}
          onChange={(event) => setKind((event.target.value || undefined) as MediaReviewKind | undefined)}
        >
          <option value="">全部用途</option>
          {(Object.keys(kindLabels) as MediaReviewKind[]).map((value) => (
            <option key={value} value={value}>
              {kindLabels[value]}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p
          className="mt-4 border-l-2 border-lumi-brand bg-lumi-brand-soft px-3 py-2 text-sm text-lumi-brand"
          role="alert"
        >
          {error}
        </p>
      )}
      {loading && !items.length ? (
        <p className="py-8 text-sm text-lumi-muted" role="status">
          正在读取图片队列…
        </p>
      ) : !items.length ? (
        <p className="py-8 text-sm text-lumi-muted">当前筛选没有图片素材。</p>
      ) : (
        <div className="mt-4 divide-y divide-lumi-line">
          <div className="flex items-center gap-3 border-b border-lumi-line py-3 text-xs text-lumi-muted">
            <input
              type="checkbox"
              aria-label="选择当前页全部待审核图片"
              disabled={status !== 'UNREVIEWED'}
              checked={
                items.some((item) => item.reviewStatus === 'UNREVIEWED') &&
                items.filter((item) => item.reviewStatus === 'UNREVIEWED').every((item) => selectedIds.has(item.id))
              }
              onChange={toggleAll}
            />
            选择当前页待审核素材
            {selectedIds.size > 0 && status === 'UNREVIEWED' && (
              <>
                <button
                  className="bg-lumi-ink px-3 py-2 text-xs text-white disabled:opacity-50"
                  disabled={busyId !== undefined}
                  onClick={() => void batchDecide('APPROVED')}
                >
                  批量通过（{selectedIds.size}）
                </button>
                <button
                  className="border border-lumi-line px-3 py-2 text-xs disabled:opacity-50"
                  disabled={busyId !== undefined}
                  onClick={() => void batchDecide('REJECTED')}
                >
                  批量拒绝
                </button>
              </>
            )}
          </div>
          {items.map((item) => (
            <article key={item.id} className="grid gap-4 py-4 md:grid-cols-[96px_minmax(0,1fr)_auto] md:items-center">
              <div className="aspect-square overflow-hidden bg-lumi-surface-muted">
                {item.url ? <img className="h-full w-full object-cover" src={item.url} alt="待审核图片" /> : null}
              </div>
              <div className="min-w-0 text-sm">
                <input
                  type="checkbox"
                  aria-label={`选择图片 ${item.id}`}
                  disabled={item.reviewStatus !== 'UNREVIEWED'}
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelected(item.id)}
                />
                <p className="font-medium">{kindLabels[item.kind]}</p>
                <p className="mt-1 truncate text-xs text-lumi-muted">
                  素材 {item.id} · 用户 {item.ownerId}
                </p>
                <p className="mt-1 text-xs text-lumi-muted">
                  {item.mimeType} · {Math.ceil(item.byteSize / 1024)} KB · {item.width ?? '—'} × {item.height ?? '—'}
                </p>
                {item.reviewReason && <p className="mt-1 text-xs text-lumi-brand">上次原因：{item.reviewReason}</p>}
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {item.reviewStatus === 'UNREVIEWED' ? (
                  <>
                    <button
                      className="bg-lumi-ink px-3 py-2 text-xs text-white disabled:opacity-50"
                      disabled={busyId !== undefined}
                      onClick={() => void decide(item, 'APPROVED')}
                    >
                      通过
                    </button>
                    <button
                      className="border border-lumi-line px-3 py-2 text-xs disabled:opacity-50"
                      disabled={busyId !== undefined}
                      onClick={() => void decide(item, 'REJECTED')}
                    >
                      拒绝
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-lumi-muted">{statusLabels[item.reviewStatus]}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {nextCursor && (
        <button
          className="mt-3 w-full border border-lumi-line px-4 py-3 text-sm disabled:opacity-50"
          disabled={loading}
          onClick={() => void load(nextCursor, true)}
        >
          加载更多图片
        </button>
      )}
    </section>
  );
}
