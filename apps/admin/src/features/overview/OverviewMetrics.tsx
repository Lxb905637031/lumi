import { useCallback, useEffect, useState } from 'react';
import { MetricCard } from '../../components/metric-card/MetricCard';
import { getAdminOverview, type AdminOverview } from '../../services/moderation-api';

const metrics: Array<{ key: keyof AdminOverview; label: string }> = [
  { key: 'pendingPosts', label: '待审核' },
  { key: 'generationToday', label: '今日生成' },
  { key: 'failedGenerations', label: '失败任务' },
  { key: 'communityPosts', label: '社区帖子' },
];

function reasonMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : '运营指标读取失败，请稍后重试。';
}

export function OverviewMetrics() {
  const [overview, setOverview] = useState<AdminOverview>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setOverview(await getAdminOverview());
    } catch (reason) {
      setError(reasonMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section aria-label="运营指标" aria-busy={loading}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">运营概况</h2>
          <p className="mt-1 text-sm text-lumi-muted">数据来自服务端，不使用固定示例数值。</p>
        </div>
        <button
          type="button"
          className="rounded-md border border-lumi-line px-3 py-2 text-sm"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? '读取中…' : '刷新指标'}
        </button>
      </div>
      {error ? (
        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-3 border-l-2 border-lumi-brand bg-lumi-brand-soft px-3 py-3 text-sm text-lumi-brand"
          role="alert"
        >
          <span>{error}</span>
          <button type="button" className="font-medium underline underline-offset-2" onClick={() => void load()}>
            重试
          </button>
        </div>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:grid-cols-4 sm:gap-4">
        {metrics.map(({ key, label }) => (
          <MetricCard key={key} label={label} value={overview?.[key] ?? (loading ? '…' : '—')} />
        ))}
      </div>
    </section>
  );
}
