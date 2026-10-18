import { AdminShell } from '../../components/admin-shell/AdminShell';
import { MetricCard, type Metric } from '../../components/metric-card/MetricCard';
import { ReviewQueue } from '../../features/moderation/ReviewQueue';

const metrics: Metric[] = [
  { label: '待审核', value: 3 },
  { label: '今日生成', value: 0 },
  { label: '失败任务', value: 0 },
  { label: '社区帖子', value: 0 },
];

export function DashboardPage() {
  return (
    <AdminShell title="内容审核工作台">
      <section className="mt-6 grid grid-cols-2 gap-3 sm:mt-10 sm:grid-cols-4 sm:gap-4" aria-label="本地演示指标">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>
      <ReviewQueue />
    </AdminShell>
  );
}
