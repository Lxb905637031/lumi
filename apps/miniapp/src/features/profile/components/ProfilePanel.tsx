import { useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { hasSession } from '../../../services/http-client';
import { ensureLogin, logout } from '../../auth/auth.api';
import './ProfilePanel.scss';

const destinations = [
  ['身材档案', '/pages/profiles/index'],
  ['我的衣橱', '/pages/wardrobe/index'],
  ['生成记录', '/pages/generations/index'],
  ['我的帖子', '/pages/posts/index?collection=mine'],
  ['我的收藏', '/pages/posts/index?collection=bookmarks'],
  ['服务消息', '/pages/messages/index'],
  ['关注与粉丝', '/pages/follows/index'],
] as const;

export function ProfilePanel({ onStartTryOn }: { onStartTryOn: () => void }) {
  const [authenticated, setAuthenticated] = useState(hasSession());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const authenticate = async () => {
    setBusy(true);
    try {
      await ensureLogin();
      setAuthenticated(true);
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败');
    } finally {
      setBusy(false);
    }
  };
  const signOut = async () => {
    setBusy(true);
    try {
      await logout();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '服务端退出未确认，本机会话已清除');
    } finally {
      setAuthenticated(false);
      setBusy(false);
    }
  };
  return (
    <View className="profile-workspace">
      <Text className="profile-section-title">我的 Lumi</Text>
      <Text className="profile-section-copy">管理你的私有资料、试穿结果和社区内容</Text>
      {error && <InlineFeedback message={error} tone="error" />}
      {!authenticated ? (
        <AppButton loading={busy} onClick={() => void authenticate()}>
          查看说明并登录
        </AppButton>
      ) : (
        <>
          {destinations.map(([title, url]) => (
            <View className="profile-record" key={url}>
              <Text className="profile-record-title">{title}</Text>
              <AppButton variant="secondary" onClick={() => void Taro.navigateTo({ url })}>
                查看
              </AppButton>
            </View>
          ))}
          <AppButton onClick={onStartTryOn}>开始试穿</AppButton>
          <AppButton variant="secondary" loading={busy} onClick={() => void signOut()}>
            退出登录
          </AppButton>
        </>
      )}
    </View>
  );
}
