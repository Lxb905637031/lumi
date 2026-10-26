import { useEffect, useRef, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { Notification } from '@lumi/contracts';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { ModalSheet } from '../../../components/ui/ModalSheet/ModalSheet';
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
  const [detail, setDetail] = useState<{ title: string; body: string; nextUrl?: string }>();
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
        setDetail({ title: '消息详情', body: destination.message });
        return;
      }
      if (destination.kind === 'ANNOUNCEMENT') {
        setDetail({ title: destination.title, body: destination.body });
        return;
      }
      if (destination.kind === 'POST' && destination.notice) {
        setDetail({
          title: '评论状态已更新',
          body: destination.notice,
          nextUrl: notificationUrl(destination) ?? undefined,
        });
        return;
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
      <ModalSheet
        open={Boolean(detail)}
        title={detail?.title ?? ''}
        footer={
          detail?.nextUrl ? (
            <AppButton block variant="primary" onClick={() => closeDetail(true)}>
              查看原帖
            </AppButton>
          ) : undefined
        }
        onClose={() => closeDetail(false)}
      >
        <Text className="profile-notification-detail">{detail?.body ?? ''}</Text>
      </ModalSheet>
    </View>
  );

  function closeDetail(continueToDestination: boolean) {
    const nextUrl = detail?.nextUrl;
    setDetail(undefined);
    if (continueToDestination && nextUrl) void Taro.navigateTo({ url: nextUrl });
  }
}
