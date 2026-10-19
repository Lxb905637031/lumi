import type { AuthSession } from '@lumi/contracts';
import Taro from '@tarojs/taro';
import { clearSession, hasSession, request, saveAccessToken, saveRefreshToken } from '../../services/http-client';

export async function ensureLogin(): Promise<void> {
  if (!hasSession()) await login();
}

export async function login(): Promise<AuthSession> {
  const agreed = Taro.getStorageSync<string>('lumi.privacyConsent');
  if (!agreed) {
    const result = await Taro.showModal({
      title: '图片与个人资料使用说明',
      content:
        '人物照片和身体参数用于你主动发起的试穿，默认私有。发布内容需审核。当前是开发环境，尚未开放真实 AI 服务；请勿上传敏感照片。是否同意并登录？',
      confirmText: '同意并登录',
    });
    if (!result.confirm) throw new Error('你可以继续浏览公开内容，需要时再登录');
    Taro.setStorageSync('lumi.privacyConsent', 'development-v1');
  }
  const bootstrap = await request<{ freeMode: boolean }>('/system/bootstrap');
  let code: string;
  if (bootstrap.freeMode) {
    const localId =
      Taro.getStorageSync<string>('lumi.localUserId') || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    Taro.setStorageSync('lumi.localUserId', localId);
    code = `local:${localId}`;
  } else {
    const result = await Taro.login();
    if (!result.code) throw new Error('微信登录暂时不可用，请重试');
    code = result.code;
  }

  const session = await request<AuthSession>('/auth/wechat/login', {
    method: 'POST',
    data: { code },
  });
  clearSession();
  saveAccessToken(session.accessToken);
  saveRefreshToken(session.refreshToken);
  return session;
}

export async function logout(): Promise<void> {
  try {
    await request('/auth/logout', { method: 'POST', data: {} });
  } finally {
    clearSession();
  }
}
