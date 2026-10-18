import type { AuthSession } from '@lumi/contracts';
import Taro from '@tarojs/taro';
import { request, saveAccessToken } from '../../services/http-client';

export async function login(): Promise<AuthSession> {
  let code = 'local:demo-user';
  try {
    const result = await Taro.login();
    if (result.code) code = result.code;
  } catch {
    // Local free mode remains usable in a browser-based Taro preview.
  }

  const session = await request<AuthSession>('/auth/wechat/login', {
    method: 'POST',
    data: { code },
  });
  saveAccessToken(session.accessToken);
  return session;
}
