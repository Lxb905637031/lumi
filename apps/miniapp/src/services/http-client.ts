import Taro from '@tarojs/taro';
import type { ApiError } from '@lumi/contracts';

const API_BASE_URL = process.env.TARO_APP_API_BASE_URL ?? 'http://127.0.0.1:4300/api/v1';
const ACCESS_TOKEN_KEY = 'lumi.accessToken';
const REFRESH_TOKEN_KEY = 'lumi.refreshToken';

function getAccessToken(): string {
  return Taro.getStorageSync<string>(ACCESS_TOKEN_KEY) || '';
}

export function saveAccessToken(accessToken: string): void {
  Taro.setStorageSync(ACCESS_TOKEN_KEY, accessToken);
}

export function saveRefreshToken(refreshToken: string): void {
  Taro.setStorageSync(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearSession(): void {
  Taro.removeStorageSync(ACCESS_TOKEN_KEY);
  Taro.removeStorageSync(REFRESH_TOKEN_KEY);
}

function getRefreshToken(): string {
  return Taro.getStorageSync<string>(REFRESH_TOKEN_KEY) || '';
}

export function hasSession(): boolean {
  return Boolean(getAccessToken() || getRefreshToken());
}

async function requestOnce<T>(path: string, options: Omit<Taro.request.Option, 'url'>, accessToken: string) {
  return Taro.request<T | ApiError>({
    url: `${API_BASE_URL}${path}`,
    ...options,
    header: {
      ...(options.data !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(options.header ?? {}),
    },
  });
}

let refreshInFlight: Promise<string> | undefined;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('登录状态已失效，请重新登录');
  refreshInFlight ??= requestOnce<{ accessToken: string; refreshToken: string }>(
    '/auth/refresh',
    { method: 'POST', data: { refreshToken } },
    '',
  )
    .then((response) => {
      if (response.statusCode >= 400) {
        if ([400, 401, 403].includes(response.statusCode)) clearSession();
        throw new Error(response.statusCode >= 500 ? '登录服务暂时不可用，请重试' : '登录状态已失效，请重新登录');
      }
      const body = response.data as { accessToken: string; refreshToken: string };
      saveAccessToken(body.accessToken);
      saveRefreshToken(body.refreshToken);
      return body.accessToken;
    })
    .finally(() => {
      refreshInFlight = undefined;
    });
  return refreshInFlight;
}

export async function request<T>(path: string, options: Omit<Taro.request.Option, 'url'> = {}): Promise<T> {
  const initialToken = getAccessToken();
  let response = await requestOnce<T>(path, options, initialToken);
  if (response.statusCode === 401 && !path.startsWith('/auth/')) {
    const accessToken = initialToken !== getAccessToken() ? getAccessToken() : await refreshAccessToken();
    response = await requestOnce<T>(path, options, accessToken);
    if (response.statusCode === 401) clearSession();
  }

  if (response.statusCode >= 400) {
    const body = response.data as ApiError;
    throw new Error(body?.message ?? `请求失败（${response.statusCode}）`);
  }
  return response.data as T;
}
