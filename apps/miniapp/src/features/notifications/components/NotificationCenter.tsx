import { useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { Notification } from '@lumi/contracts';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { ResourceStatus } from '../../../components/ui/ResourceStatus/ResourceStatus';
import { useCursorList } from '../../../hooks/useCursorList';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../notifications.api';
import '../../profile/components/ProfilePanel.scss';

export function NotificationCenter() {
  const list = useCursorList(listNotifications);
  const [error, setError] = useState<string>();
  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      await list.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败');
    }
  };
  const open = async (item: Notification) => {
    try {
      await markNotificationRead(item.id);
      await list.reload();
      if (!item.targetId) return;
      const page =
        item.targetType === 'POST'
          ? '/pages/post/index'
          : item.targetType === 'GENERATION_JOB'
            ? '/pages/generations/index'
            : undefined;
      if (page) await Taro.navigateTo({ url: page + '?id=' + encodeURIComponent(item.targetId) });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '消息打开失败');
    }
  };
  return (
    <View>
      <View className="feature-page-heading">
        <Text className="feature-eyebrow">UPDATES</Text>
        <Text className="page-title">服务消息</Text>
        <Text className="page-description">任务、审核和社区互动的状态更新。</Text>
      </View>
      <AppButton compact variant="secondary" onClick={() => void markAll()}>
        全部标记为已读
      </AppButton>
      <ResourceStatus
        loading={list.loading}
        error={list.error}
        empty={!list.items.length}
        onRetry={() => void list.reload()}
      />
      {error && <InlineFeedback message={error} tone="error" />}
      {list.items.map((item) => (
        <View className="profile-notification" key={item.id} onClick={() => void open(item)}>
          <View>
            <Text>
              {item.readAt ? '已读 · ' : '未读 · '}
              {item.title}
            </Text>
            <Text className="profile-muted">{item.body}</Text>
            <Text className="profile-muted">{new Date(item.createdAt).toLocaleString('zh-CN')}</Text>
          </View>
        </View>
      ))}
      {list.hasMore && (
        <AppButton block variant="secondary" onClick={() => void list.loadMore()}>
          更多消息
        </AppButton>
      )}
    </View>
  );
}
