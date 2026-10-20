import { useCallback, useEffect, useState } from 'react';
import type { CommentModerationItem } from '../../services/moderation-api';
import { listModerationComments, updateCommentModerationStatus } from '../../services/moderation-api';

export function CommentReviewQueue() {
  const [items, setItems] = useState<CommentModerationItem[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async (next?: string, append = false) => {
    setLoading(true);
    setError(undefined);
    try {
      const page = await listModerationComments('PENDING', next);
      setItems((current) => (append ? [...current, ...page.items] : page.items));
      setCursor(next);
      setNextCursor(page.nextCursor ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '评论队列读取失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (item: CommentModerationItem, status: 'APPROVED' | 'REJECTED') => {
    const reason = window.prompt(status === 'APPROVED' ? '通过说明（可留空）' : '拒绝原因（必填）', '');
    if (reason === null || (status === 'REJECTED' && !reason.trim())) return;
    setBusyId(item.id);
    setError(undefined);
    try {
      await updateCommentModerationStatus(item.id, status, reason.trim());
      setItems((current) => current.filter((row) => row.id !== item.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '审核状态未确认，请刷新队列核对');
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <section className="mt-6 border-t border-lumi-line pt-6" aria-labelledby="comment-review-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold" id="comment-review-title">
            评论审核
          </h2>
          <p className="mt-1 text-sm text-lumi-muted">仅展示待审核评论；处理会通知作者并写入审计记录。</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-lumi-muted">{loading ? '读取中' : `${items.length} 条`}</span>
          <button className="rounded-md border border-lumi-line px-3 py-2 text-sm" onClick={() => void load(cursor)}>
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
        <p className="py-8 text-sm text-lumi-muted">当前没有待审核评论。</p>
      ) : (
        <div className="mt-4 divide-y divide-lumi-line">
          {items.map((item) => (
            <article className="grid gap-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" key={item.id}>
              <div className="min-w-0">
                <p className="whitespace-pre-wrap break-words text-sm">{item.body}</p>
                <p className="mt-2 text-xs text-lumi-muted">
                  作者 {item.authorId} · 帖子 {item.postId} · {new Date(item.createdAt).toLocaleString('zh-CN')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-md bg-lumi-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  disabled={busyId === item.id}
                  onClick={() => void decide(item, 'APPROVED')}
                >
                  通过
                </button>
                <button
                  className="rounded-md border border-lumi-line px-3 py-2 text-sm font-medium disabled:opacity-50"
                  disabled={busyId === item.id}
                  onClick={() => void decide(item, 'REJECTED')}
                >
                  拒绝
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {nextCursor && (
        <button
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
