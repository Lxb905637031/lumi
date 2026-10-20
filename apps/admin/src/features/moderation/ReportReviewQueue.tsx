import { useCallback, useEffect, useState } from 'react';
import type { ReportQueueItem, ReportStatus } from '@lumi/contracts';
import { listModerationReports, updateReportStatus } from '../../services/moderation-api';

const labels: Record<ReportStatus, string> = { OPEN: '待处理', RESOLVED: '已处理', REJECTED: '不成立' };

export function ReportReviewQueue() {
  const [items, setItems] = useState<ReportQueueItem[]>([]);
  const [status, setStatus] = useState<ReportStatus>('OPEN');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(
    async (cursor?: string, append = false) => {
      setLoading(true);
      setError(undefined);
      try {
        const page = await listModerationReports(status, cursor);
        setItems((current) => (append ? [...current, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '举报队列读取失败');
      } finally {
        setLoading(false);
      }
    },
    [status],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (item: ReportQueueItem, next: 'RESOLVED' | 'REJECTED') => {
    const reason = window.prompt(next === 'RESOLVED' ? '处理说明（必填）' : '不成立原因（必填）', '');
    if (reason === null || !reason.trim()) return;
    setBusyId(item.id);
    setError(undefined);
    try {
      const updated = await updateReportStatus(item.id, next, reason);
      setItems((current) => current.map((row) => (row.id === item.id ? updated : row)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '处理失败，请刷新确认状态');
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <section className="mt-6 border-t border-lumi-line pt-6" aria-labelledby="report-review-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="report-review-title" className="text-xl font-semibold">
            举报处理
          </h2>
          <p className="mt-1 text-sm text-lumi-muted">处理结果将通知举报者，并保留状态与处理说明。</p>
          <div className="mt-3 flex gap-2">
            {(['OPEN', 'RESOLVED', 'REJECTED'] as const).map((value) => (
              <button
                key={value}
                className={`rounded-md border px-3 py-2 text-xs ${status === value ? 'border-lumi-ink bg-lumi-ink text-white' : 'border-lumi-line'}`}
                onClick={() => setStatus(value)}
              >
                {labels[value]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-lumi-muted">{loading ? '读取中' : `${items.length} 条`}</span>
          <button className="rounded-md border border-lumi-line px-3 py-2 text-sm" onClick={() => void load()}>
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
          正在读取服务端举报队列…
        </p>
      ) : !items.length ? (
        <p className="py-8 text-sm text-lumi-muted">当前没有举报记录。</p>
      ) : (
        <div className="mt-4 divide-y divide-lumi-line">
          {items.map((item) => (
            <article key={item.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.postTitle}</p>
                <p className="mt-1 break-words text-sm text-lumi-muted">{item.postPreview}</p>
                <p className="mt-2 text-xs text-lumi-muted">
                  举报原因：{item.reason} · 举报者 {item.reporterId} ·{' '}
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </p>
                {item.resolutionReason && (
                  <p className="mt-1 text-xs text-lumi-muted">处理说明：{item.resolutionReason}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-lumi-muted">{labels[item.status]}</span>
                {item.status === 'OPEN' && (
                  <>
                    <button
                      className="rounded-md bg-lumi-ink px-3 py-2 text-xs text-white disabled:opacity-50"
                      disabled={busyId === item.id}
                      onClick={() => void decide(item, 'RESOLVED')}
                    >
                      确认处理
                    </button>
                    <button
                      className="rounded-md border border-lumi-line px-3 py-2 text-xs disabled:opacity-50"
                      disabled={busyId === item.id}
                      onClick={() => void decide(item, 'REJECTED')}
                    >
                      不成立
                    </button>
                  </>
                )}
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
          加载更多举报
        </button>
      )}
    </section>
  );
}
