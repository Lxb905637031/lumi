import Taro from '@tarojs/taro';
import type { ApiError } from '@lumi/contracts';

const API_BASE_URL = process.env.TARO_APP_API_BASE_URL ?? 'http://127.0.0.1:4300/api/v1';
const ACCESS_TOKEN_KEY = 'lumi.accessToken';

function getAccessToken(): string {
  return Taro.getStorageSync<string>(ACCESS_TOKEN_KEY) || '';
}

export function saveAccessToken(accessToken: string): void {
  Taro.setStorageSync(ACCESS_TOKEN_KEY, accessToken);
}

export async function request<T>(path: string, options: Omit<Taro.request.Option, 'url'> = {}): Promise<T> {
  const response = await Taro.request<T | ApiError>({
    url: `${API_BASE_URL}${path}`,
    ...options,
    header: {
      'content-type': 'application/json',
      ...(getAccessToken() ? { authorization: `Bearer ${getAccessToken()}` } : {}),
      ...(options.header ?? {}),
    },
  });

  if (response.statusCode >= 400) {
    const body = response.data as ApiError;
    throw new Error(body?.message ?? `请求失败（${response.statusCode}）`);
  }
  return response.data as T;
}
