import Taro from '@tarojs/taro';

const API_BASE_URL = process.env.TARO_APP_API_BASE_URL ?? 'http://127.0.0.1:4300/api/v1';

type ApiResponse<T> = { data: T; statusCode: number };

function token() {
  return Taro.getStorageSync<string>('lumi.accessToken') || '';
}

async function request<T>(path: string, options: Omit<Taro.request.Option, 'url'> = {}): Promise<T> {
  const result = await Taro.request<T>({
    url: `${API_BASE_URL}${path}`,
    ...options,
    header: {
      'content-type': 'application/json',
      ...(token() ? { authorization: `Bearer ${token()}` } : {}),
      ...(options.header ?? {}),
    },
  });
  const response = result as ApiResponse<T>;
  if (response.statusCode >= 400) throw new Error(`请求失败（${response.statusCode}）`);
  return response.data;
}

export type AuthSession = { accessToken: string; user: { id: string; openId: string }; freeMode: boolean };
export type BodyProfileVersion = { id: string; version: number; measurements: Record<string, number | null> };
export type BodyProfile = { id: string; name: string; activeVersion: number; versions: BodyProfileVersion[] };
export type ClothingItem = { id: string; name: string; category: string };
export type GenerationJob = { id: string; status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'; provider: string };

export async function login() {
  let code = 'local:demo-user';
  try {
    const loginResult = await Taro.login();
    if (loginResult.code) code = loginResult.code;
  } catch {
    // The local fallback keeps the free development mode usable outside WeChat.
  }
  const session = await request<AuthSession>('/auth/wechat/login', { method: 'POST', data: { code } });
  Taro.setStorageSync('lumi.accessToken', session.accessToken);
  return session;
}

export const api = {
  login,
  listProfiles: () => request<BodyProfile[]>('/body-profiles'),
  createProfile: (data: { name: string; heightCm?: number; weightKg?: number }) =>
    request<{ profile: BodyProfile; id: string; version: number; measurements: Record<string, number | null> }>('/body-profiles', {
      method: 'POST', data,
    }),
  listClothing: () => request<ClothingItem[]>('/wardrobe/items'),
  createClothing: (data: { name: string; category: 'TOP' | 'BOTTOM' | 'DRESS' }) =>
    request<ClothingItem>('/wardrobe/items', { method: 'POST', data }),
  createGeneration: (data: { profileVersionId: string; clothingAssetId: string; idempotencyKey: string }) =>
    request<GenerationJob>('/generation-jobs', { method: 'POST', data }),
  getGeneration: (id: string) => request<GenerationJob>(`/generation-jobs/${id}`),
};
