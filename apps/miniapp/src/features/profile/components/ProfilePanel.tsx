import { useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { hasSession } from '../../../services/http-client';
import { getAuthErrorMessage } from '../../auth/auth-error';
import { ensureLogin, logout } from '../../auth/auth.api';
import './ProfilePanel.scss';

const destinations = [
  ['人物档案', '/pages/profiles/index', '照片和参数仅用于你主动发起的试穿'],
  ['我的衣橱', '/pages/wardrobe/index', '管理你上传的单品和衣物信息'],
  ['试穿记录', '/pages/generations/index', '查看任务状态，确认和管理私有结果'],
  ['我的发布', '/pages/posts/index?collection=mine', '查看草稿、审核状态和已发布内容'],
  ['我的收藏', '/pages/posts/index?collection=bookmarks', '找回收藏的穿搭灵感'],
  ['服务消息', '/pages/messages/index', '查看任务和内容审核通知'],
  ['关注与粉丝', '/pages/follows/index', '管理你关注的创作者和关注关系'],
  ['账号与隐私', '/pages/privacy/index', '申请数据导出或管理账号注销'],
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
      setError(getAuthErrorMessage(reason, '登录失败，请检查网络后重试'));
    } finally {
      setBusy(false);
    }
  };
  const signOut = async () => {
    setBusy(true);
    try {
      await logout();
    } catch (reason) {
      setError(getAuthErrorMessage(reason, '服务端退出未确认，本机会话已清除'));
    } finally {
      setAuthenticated(false);
      setBusy(false);
    }
  };
  const openDestination = (url: string) => {
    if (url === '/pages/wardrobe/index') {
      return Taro.switchTab({ url });
    }
    return Taro.navigateTo({ url });
  };
  return (
    <View className="profile-workspace">
      <View className="profile-page-heading">
        <Text className="profile-eyebrow">MY ACCOUNT</Text>
        <Text className="profile-section-title">我的 Lumi</Text>
        <Text className="profile-section-copy">你的私有资料、试穿记录和社区内容</Text>
      </View>
      {error && <InlineFeedback message={error} tone="error" />}
      {!authenticated ? (
        <View className="profile-login surface">
          <Text className="section-title">登录后管理你的衣橱</Text>
          <Text className="section-caption">公开内容仍可浏览。人物照片和身体参数默认私有，提交前会再次确认。</Text>
          <AppButton block loading={busy} onClick={() => void authenticate()}>
            查看说明并登录
          </AppButton>
        </View>
      ) : (
        <>
          <View className="profile-menu-list surface">
            {destinations.map(([title, url, description]) => (
              <View className="profile-menu-row" key={url} role="button" onClick={() => void openDestination(url)}>
                <View className="profile-menu-copy">
                  <Text className="profile-record-title">{title}</Text>
                  <Text className="profile-muted">{description}</Text>
                </View>
                <Text className="profile-menu-action">管理</Text>
              </View>
            ))}
          </View>
          <View className="profile-actions">
            <AppButton block onClick={onStartTryOn}>
              开始一次试穿
            </AppButton>
            <AppButton block variant="secondary" loading={busy} onClick={() => void signOut()}>
              退出登录
            </AppButton>
          </View>
        </>
      )}
    </View>
  );
}
