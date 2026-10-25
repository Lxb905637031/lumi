import Taro from '@tarojs/taro';
import type { ApiError, ApiSuccess, AuthSession } from '@lumi/contracts';
import { ApiRequestError } from './api-request-error';
import { createSessionRefreshCoordinator } from './session-refresh';

const API_BASE_URL = process.env.TARO_APP_API_BASE_URL ?? 'http://127.0.0.1:4300/api/v1';
const ACCESS_TOKEN_KEY = 'lumi.accessToken';
const REFRESH_TOKEN_KEY = 'lumi.refreshToken';
let sessionEpoch = 0;

export function getSessionEpoch(): number {
  return sessionEpoch;
}

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
  sessionEpoch += 1;
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
  return Taro.request<ApiSuccess<T> | ApiError>({
    url: `${API_BASE_URL}${path}`,
    timeout: 15_000,
    ...options,
    header: {
      ...(options.data !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(options.header ?? {}),
    },
  });
}

function readError(body: ApiError | unknown, statusCode: number, headerRequestId?: string): ApiRequestError {
  const error = body as Partial<ApiError>;
  const message = Array.isArray(error.message)
    ? error.message.join('；')
    : error.message || `请求失败（${statusCode}）`;
  return new ApiRequestError(message, statusCode, error.code, error.meta?.requestId ?? headerRequestId);
}

function responseRequestId(header?: Record<string, string | undefined>): string | undefined {
  if (!header) return undefined;
  const entry = Object.entries(header).find(([key]) => key.toLowerCase() === 'x-request-id');
  return entry?.[1];
}

const refreshAccessToken = createSessionRefreshCoordinator({
  getRefreshToken,
  getSessionEpoch,
  refresh: (refreshToken) => requestOnce<AuthSession>('/auth/refresh', { method: 'POST', data: { refreshToken } }, ''),
  save: (session) => {
    saveAccessToken(session.accessToken);
    saveRefreshToken(session.refreshToken);
  },
  clear: clearSession,
  requestId: responseRequestId,
});

export async function request<T>(path: string, options: Omit<Taro.request.Option, 'url'> = {}): Promise<T> {
  const initialToken = getAccessToken();
  let response = await requestOnce<T>(path, options, initialToken);
  if (response.statusCode === 401 && !path.startsWith('/auth/')) {
    const accessToken = initialToken !== getAccessToken() ? getAccessToken() : await refreshAccessToken();
    response = await requestOnce<T>(path, options, accessToken);
    if (response.statusCode === 401) clearSession();
  }

  if (response.statusCode >= 400) {
    throw readError(response.data, response.statusCode, responseRequestId(response.header));
  }
  const body = response.data as ApiSuccess<T> | ApiError;
  if (!body.success) throw readError(body, response.statusCode, responseRequestId(response.header));
  return body.data;
}
