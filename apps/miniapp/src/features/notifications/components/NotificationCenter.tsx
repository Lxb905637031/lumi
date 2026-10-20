import { useEffect, useRef, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { Notification } from '@lumi/contracts';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { ResourceStatus } from '../../../components/ui/ResourceStatus/ResourceStatus';
import { useCursorList } from '../../../hooks/useCursorList';
import {
  getNotificationDestination,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../notifications.api';
import { notificationUrl } from '../notification-destination';
import { getSessionEpoch } from '../../../services/http-client';
import '../../profile/components/ProfilePanel.scss';

export function NotificationCenter() {
  const list = useCursorList(listNotifications);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const markAll = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      await markAllNotificationsRead();
      await list.reload();
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : '操作失败');
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  };
  const open = async (item: Notification) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    const epoch = getSessionEpoch();
    const current = () => mounted.current && getSessionEpoch() === epoch;
    try {
      const destination = await getNotificationDestination(item.id);
      if (!current()) return;
      await markNotificationRead(item.id);
      if (!current()) return;
      await list.reload();
      if (!current()) return;
      if (destination.kind === 'UNAVAILABLE') {
        await Taro.showModal({ title: '消息详情', content: destination.message, showCancel: false });
        return;
      }
      if (destination.kind === 'ANNOUNCEMENT') {
        await Taro.showModal({ title: destination.title, content: destination.body, showCancel: false });
        return;
      }
      if (destination.kind === 'POST' && destination.notice) {
        await Taro.showModal({ title: '评论状态已更新', content: destination.notice, showCancel: false });
      }
      const url = notificationUrl(destination);
      if (url && current()) await Taro.navigateTo({ url });
    } catch (reason) {
      if (current()) setError(reason instanceof Error ? reason.message : '消息打开失败');
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  };
  return (
    <View>
      <View className="feature-page-heading">
        <Text className="feature-eyebrow">UPDATES</Text>
        <Text className="page-title">服务消息</Text>
        <Text className="page-description">任务、审核和社区互动的状态更新。</Text>
      </View>
      <AppButton compact variant="secondary" disabled={pending} onClick={() => void markAll()}>
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
