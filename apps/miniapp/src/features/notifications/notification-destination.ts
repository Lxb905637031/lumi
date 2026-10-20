import type { NotificationDestination } from '@lumi/contracts';

export function notificationUrl(destination: NotificationDestination): string | null {
  switch (destination.kind) {
    case 'POST':
      return `/pages/post/index?id=${encodeURIComponent(destination.id)}${destination.commentId ? `&commentId=${encodeURIComponent(destination.commentId)}` : ''}`;
    case 'GENERATION_JOB':
      return `/pages/generations/index?id=${encodeURIComponent(destination.id)}`;
    case 'FOLLOWERS':
      return '/pages/follows/index?mode=followers';
    case 'UNAVAILABLE':
      return null;
  }
}
