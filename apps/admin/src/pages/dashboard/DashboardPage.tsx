import { AdminShell } from '../../components/admin-shell/AdminShell';
import { MetricCard, type Metric } from '../../components/metric-card/MetricCard';
import { ReviewQueue } from '../../features/moderation/ReviewQueue';
import { CommentReviewQueue } from '../../features/moderation/CommentReviewQueue';
import { ReportReviewQueue } from '../../features/moderation/ReportReviewQueue';
import { getAdminOverview, type AdminOverview } from '../../services/moderation-api';
import { logoutAdmin } from '../../services/admin-session';
import { AnnouncementComposer } from '../../features/announcements/AnnouncementComposer';
import { useEffect, useState } from 'react';

export function DashboardPage({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [overview, setOverview] = useState<AdminOverview>();
  useEffect(() => {
    void getAdminOverview()
      .then(setOverview)
      .catch(() => undefined);
  }, []);
  const metrics: Metric[] = [
    { label: '待审核', value: overview?.pendingPosts ?? '—' },
    { label: '今日生成', value: overview?.generationToday ?? '—' },
    { label: '失败任务', value: overview?.failedGenerations ?? '—' },
    { label: '社区帖子', value: overview?.communityPosts ?? '—' },
  ];
  return (
    <AdminShell
      title="内容审核工作台"
      onLogout={async () => {
        await logoutAdmin();
        onLoggedOut();
      }}
    >
      <section className="mt-6 grid grid-cols-2 gap-3 sm:mt-10 sm:grid-cols-4 sm:gap-4" aria-label="运营指标">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>
      <ReviewQueue />
      <CommentReviewQueue />
      <ReportReviewQueue />
      <AnnouncementComposer />
    </AdminShell>
  );
}
