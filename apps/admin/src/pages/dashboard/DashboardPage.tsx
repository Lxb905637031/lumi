import { AdminShell } from '../../components/admin-shell/AdminShell';
import { ReviewQueue } from '../../features/moderation/ReviewQueue';
import { CommentReviewQueue } from '../../features/moderation/CommentReviewQueue';
import { ReportReviewQueue } from '../../features/moderation/ReportReviewQueue';
import { logoutAdmin } from '../../services/admin-session';
import { AnnouncementComposer } from '../../features/announcements/AnnouncementComposer';
import { UserModerationPanel } from '../../features/users/UserModerationPanel';
import { MediaReviewQueue } from '../../features/moderation/MediaReviewQueue';
import { ChallengeOperations } from '../../features/challenges/ChallengeOperations';
import { RuntimeConfigPanel } from '../../features/config/RuntimeConfigPanel';
import { AuditLogPanel } from '../../features/audit/AuditLogPanel';
import { OverviewMetrics } from '../../features/overview/OverviewMetrics';

export function DashboardPage({ onLoggedOut }: { onLoggedOut: () => void }) {
  return (
    <AdminShell
      title="内容审核工作台"
      onLogout={async () => {
        await logoutAdmin();
        onLoggedOut();
      }}
    >
      <div className="mt-6 sm:mt-10">
        <OverviewMetrics />
      </div>
      <ReviewQueue />
      <CommentReviewQueue />
      <MediaReviewQueue />
      <ReportReviewQueue />
      <AnnouncementComposer />
      <UserModerationPanel />
      <ChallengeOperations />
      <RuntimeConfigPanel />
      <AuditLogPanel />
    </AdminShell>
  );
}
