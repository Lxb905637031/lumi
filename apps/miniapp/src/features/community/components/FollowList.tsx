import { useMemo, useState } from 'react';
import { Text, View } from '@tarojs/components';
import type { CommunityUser } from '@lumi/contracts';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { ResourceStatus } from '../../../components/ui/ResourceStatus/ResourceStatus';
import { useCursorList } from '../../../hooks/useCursorList';
import { listFollowers, listFollowing, setFollow } from '../follows.api';
import '../../profile/components/ProfilePanel.scss';

type Mode = 'following' | 'followers';
export function FollowList() {
  const [mode, setMode] = useState<Mode>('following');
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const fetcher = useMemo(() => (mode === 'following' ? listFollowing : listFollowers), [mode]);
  const list = useCursorList<CommunityUser>(fetcher);
  const switchMode = (next: Mode) => {
    if (next !== mode) {
      setMode(next);
      setError(undefined);
    }
  };
  const toggle = async (user: CommunityUser) => {
    if (busyId) return;
    setBusyId(user.id);
    setError(undefined);
    try {
      await setFollow(user.id, !user.followed);
      await list.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '关系更新失败，请重试');
    } finally {
      setBusyId(undefined);
    }
  };
  return (
    <View>
      <View className="feature-page-heading">
        <Text className="feature-eyebrow">YOUR PEOPLE</Text>
        <Text className="page-title">关注与粉丝</Text>
        <Text className="page-description">管理你关注的创作者和与你产生连接的人。</Text>
      </View>
      <View className="profile-section">
        <View className="feed-card-actions">
          <AppButton
            compact
            variant={mode === 'following' ? 'primary' : 'secondary'}
            onClick={() => switchMode('following')}
          >
            我关注的
          </AppButton>
          <AppButton
            compact
            variant={mode === 'followers' ? 'primary' : 'secondary'}
            onClick={() => switchMode('followers')}
          >
            关注我的
          </AppButton>
        </View>
        {error && <InlineFeedback message={error} tone="error" />}
        <ResourceStatus
          loading={list.loading}
          error={list.error}
          empty={!list.items.length}
          onRetry={() => void list.reload()}
        />
        {list.items.map((user) => (
          <View className="profile-record" key={user.id}>
            <Text>{user.displayName}</Text>
            <AppButton compact variant="secondary" loading={busyId === user.id} onClick={() => void toggle(user)}>
              {user.followed ? '取消关注' : '回关'}
            </AppButton>
          </View>
        ))}
        {list.hasMore && (
          <AppButton block variant="secondary" onClick={() => void list.loadMore()}>
            更多
          </AppButton>
        )}
      </View>
    </View>
  );
}
