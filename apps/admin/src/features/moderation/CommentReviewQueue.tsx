import { useCallback, useEffect, useState } from 'react';
import type { ModerationStatus } from '@lumi/contracts';
import type { CommentModerationAction, CommentModerationItem } from '../../services/moderation-api';
import {
  listCommentModerationActions,
  listModerationComments,
  updateCommentModerationStatus,
} from '../../services/moderation-api';

const statusLabels: Record<ModerationStatus, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  REMOVED: '已下架',
};

const actionLabels = {
  APPROVED: '通过',
  REJECTED: '拒绝',
  REMOVED: '下架',
} as const;

export function CommentReviewQueue() {
  const [items, setItems] = useState<CommentModerationItem[]>([]);
  const [status, setStatus] = useState<ModerationStatus>('PENDING');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  const [history, setHistory] = useState<Record<string, CommentModerationAction[]>>({});
  const [historyCursors, setHistoryCursors] = useState<Record<string, string | null>>({});
  const [historyLoadingId, setHistoryLoadingId] = useState<string>();

  const load = useCallback(
    async (cursor?: string, append = false) => {
      setLoading(true);
      setError(undefined);
      try {
        const page = await listModerationComments(status, cursor);
        setItems((current) => (append ? [...current, ...page.items] : page.items));
        setNextCursor(page.nextCursor ?? null);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '评论队列读取失败');
      } finally {
        setLoading(false);
      }
    },
    [status],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (item: CommentModerationItem, nextStatus: Exclude<ModerationStatus, 'PENDING'>) => {
    const reason = window.prompt(
      nextStatus === 'APPROVED' ? '通过说明（可留空）' : `${actionLabels[nextStatus]}原因（必填）`,
      '',
    );
    if (reason === null || (nextStatus !== 'APPROVED' && !reason.trim())) return;
    setBusyId(item.id);
    setError(undefined);
    try {
      await updateCommentModerationStatus(item.id, nextStatus, reason.trim());
      setItems((current) => current.filter((row) => row.id !== item.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '审核状态未确认，请刷新队列核对');
    } finally {
      setBusyId(undefined);
    }
  };

  const showHistory = async (id: string, append = false) => {
    setHistoryLoadingId(id);
    setError(undefined);
    try {
      const page = await listCommentModerationActions(id, append ? (historyCursors[id] ?? undefined) : undefined);
      setHistory((current) => ({ ...current, [id]: append ? [...(current[id] ?? []), ...page.items] : page.items }));
      setHistoryCursors((current) => ({ ...current, [id]: page.nextCursor }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '评论审计记录读取失败');
    } finally {
      setHistoryLoadingId(undefined);
    }
  };

  return (
    <section
      className="mt-6 rounded-lg border border-lumi-line bg-lumi-surface p-5 sm:p-6"
      aria-labelledby="comment-review-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold" id="comment-review-title">
            评论审核
          </h2>
          <p className="mt-1 text-sm text-lumi-muted">审核结果会通知作者，并通过事务写入审计记录。</p>
          <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="评论审核状态">
            {(Object.keys(statusLabels) as ModerationStatus[]).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={status === value}
                className={`rounded-md border px-3 py-2 text-xs font-medium ${status === value ? 'border-lumi-ink bg-lumi-ink text-white' : 'border-lumi-line'}`}
                onClick={() => setStatus(value)}
              >
                {statusLabels[value]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-lumi-muted">{loading ? '读取中' : `${items.length} 条`}</span>
          <button
            type="button"
            className="rounded-md border border-lumi-line px-3 py-2 text-sm"
            onClick={() => void load()}
            disabled={loading}
          >
            刷新
          </button>
        </div>
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
          正在读取服务端评论队列…
        </p>
      ) : !items.length ? (
        <p className="py-8 text-sm text-lumi-muted">当前筛选没有评论。</p>
      ) : (
        <div className="mt-4 divide-y divide-lumi-line">
          {items.map((item) => (
            <article className="grid gap-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" key={item.id}>
              <div className="min-w-0">
                <p className="whitespace-pre-wrap break-words text-sm">{item.body}</p>
                <p className="mt-2 text-xs text-lumi-muted">
                  {statusLabels[item.moderationStatus]} · 作者 {item.authorId} · 帖子 {item.postId} ·{' '}
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </p>
              </div>
              {item.moderationStatus === 'PENDING' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-lumi-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    disabled={busyId === item.id}
                    onClick={() => void decide(item, 'APPROVED')}
                  >
                    通过
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-lumi-line px-3 py-2 text-sm font-medium disabled:opacity-50"
                    disabled={busyId === item.id}
                    onClick={() => void decide(item, 'REJECTED')}
                  >
                    拒绝
                  </button>
                </div>
              ) : item.moderationStatus === 'APPROVED' ? (
                <button
                  type="button"
                  className="rounded-md border border-lumi-brand px-3 py-2 text-sm font-medium text-lumi-brand disabled:opacity-50"
                  disabled={busyId === item.id}
                  onClick={() => void decide(item, 'REMOVED')}
                >
                  下架
                </button>
              ) : (
                <span className="text-xs text-lumi-muted">已完成处理</span>
              )}
              <div className="col-span-full flex flex-wrap items-center gap-3 border-l-2 border-lumi-line pl-3">
                <button
                  type="button"
                  className="text-xs text-lumi-muted underline decoration-lumi-line underline-offset-4"
                  disabled={historyLoadingId === item.id}
                  onClick={() => void showHistory(item.id)}
                >
                  {history[item.id] ? '刷新操作记录' : '查看操作记录'}
                </button>
                {history[item.id]?.length === 0 && <span className="text-xs text-lumi-muted">暂无审核记录</span>}
                {history[item.id]?.map((action) => (
                  <span className="text-xs text-lumi-muted" key={action.id}>
                    {statusLabels[action.fromStatus]} → {statusLabels[action.toStatus]} · 操作者 {action.actorId} ·{' '}
                    {action.reason || '未填写理由'} · {new Date(action.createdAt).toLocaleString('zh-CN')}
                  </span>
                ))}
                {history[item.id] && historyCursors[item.id] && (
                  <button
                    type="button"
                    className="text-xs text-lumi-brand underline decoration-lumi-brand underline-offset-4"
                    disabled={historyLoadingId === item.id}
                    onClick={() => void showHistory(item.id, true)}
                  >
                    加载更早记录
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {nextCursor && (
        <button
          type="button"
          className="mt-3 w-full rounded-md border border-lumi-line px-4 py-3 text-sm disabled:opacity-50"
          disabled={loading}
          onClick={() => void load(nextCursor, true)}
        >
          加载更多评论
        </button>
      )}
    </section>
  );
}
