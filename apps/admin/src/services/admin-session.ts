import type { AuthSession } from '@lumi/contracts';

const ACCESS_KEY = 'lumi.admin.accessToken';
const REFRESH_KEY = 'lumi.admin.refreshToken';
export const ADMIN_SESSION_EXPIRED_EVENT = 'lumi:admin-session-expired';
let refreshInFlight: Promise<string> | undefined;

export function currentAccessToken() {
  return sessionStorage.getItem(ACCESS_KEY) ?? '';
}

function currentRefreshToken() {
  return sessionStorage.getItem(REFRESH_KEY) ?? '';
}

export function hasAdminSession() {
  return Boolean(currentAccessToken() && currentRefreshToken());
}

export function clearAdminSession() {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
}

export function saveAdminSession(session: AuthSession) {
  sessionStorage.setItem(ACCESS_KEY, session.accessToken);
  sessionStorage.setItem(REFRESH_KEY, session.refreshToken);
}

export async function loginAdmin(username: string, password: string): Promise<AuthSession> {
  const response = await fetch(`${apiUrl()}/auth/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = (await response.json()) as AuthSession | { message?: string };
  if (!response.ok || !('accessToken' in body)) {
    throw new Error('message' in body && body.message ? body.message : '登录失败，请检查账号密码');
  }
  if (body.user.role !== 'ADMIN' && body.user.role !== 'MODERATOR') throw new Error('当前账号没有后台权限');
  saveAdminSession(body);
  return body;
}

export async function logoutAdmin() {
  try {
    const token = currentAccessToken();
    if (token) {
      await fetch(`${apiUrl()}/auth/logout`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    }
  } finally {
    clearAdminSession();
  }
}

export async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const send = (token: string) =>
    fetch(`${apiUrl()}${path}`, {
      ...init,
      headers: {
        ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  const initialToken = currentAccessToken();
  let response = await send(initialToken);
  if (response.status === 401) {
    const token = initialToken !== currentAccessToken() ? currentAccessToken() : await refreshAdminSession();
    response = await send(token);
    if (response.status === 401) clearAdminSession();
  }
  const body = (await response.json()) as T | { message?: string };
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'message' in body ? body.message : undefined;
    throw new Error(message || `后台请求失败（${response.status}）`);
  }
  return body as T;
}

async function refreshAdminSession(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = currentRefreshToken();
  if (!refreshToken) {
    clearAdminSession();
    throw new Error('后台登录状态已失效');
  }
  refreshInFlight = (async () => {
    const refreshed = await fetch(`${apiUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!refreshed.ok) {
      if ([400, 401, 403].includes(refreshed.status)) clearAdminSession();
      throw new Error(refreshed.status >= 500 ? '登录服务暂时不可用，请重试' : '后台登录状态已失效');
    }
    const session = (await refreshed.json()) as AuthSession;
    if (session.user.role !== 'ADMIN' && session.user.role !== 'MODERATOR') {
      clearAdminSession();
      throw new Error('当前账号没有后台权限');
    }
    if (currentRefreshToken() !== refreshToken) throw new Error('后台会话已改变，请重新登录');
    saveAdminSession(session);
    return session.accessToken;
  })().finally(() => {
    refreshInFlight = undefined;
  });
  return refreshInFlight;
}

export function apiUrl() {
  return (import.meta.env.VITE_LUMI_API_URL ?? 'http://localhost:4300/api/v1').replace(/\/$/, '');
}
