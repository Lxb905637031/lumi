import type { ApiError, ApiSuccess, AuthSession } from '@lumi/contracts';
import { ApiRequestError } from './api-request-error';

type RefreshResponse = {
  statusCode: number;
  header?: Record<string, string | undefined>;
  data: ApiSuccess<AuthSession> | ApiError;
};

type SessionRefreshOptions = {
  getRefreshToken(): string;
  getSessionEpoch(): number;
  refresh(refreshToken: string): Promise<RefreshResponse>;
  save(session: AuthSession): void;
  clear(): void;
  requestId(header?: Record<string, string | undefined>): string | undefined;
};

function responseError(response: RefreshResponse, requestId?: string): ApiRequestError {
  const body = response.data as Partial<ApiError>;
  const message = Array.isArray(body.message)
    ? body.message.join('；')
    : body.message || `请求失败（${response.statusCode}）`;
  return new ApiRequestError(message, response.statusCode, body.code, body.meta?.requestId ?? requestId);
}

export function createSessionRefreshCoordinator(options: SessionRefreshOptions) {
  let refreshInFlight: { epoch: number; refreshToken: string; promise: Promise<string> } | undefined;

  return function refreshAccessToken(): Promise<string> {
    const refreshToken = options.getRefreshToken();
    const sessionEpoch = options.getSessionEpoch();
    if (!refreshToken) return Promise.reject(new Error('登录状态已失效，请重新登录'));
    if (refreshInFlight && refreshInFlight.epoch === sessionEpoch && refreshInFlight.refreshToken === refreshToken) {
      return refreshInFlight.promise;
    }

    const promise = options
      .refresh(refreshToken)
      .then((response) => {
        const body = response.data as ApiSuccess<AuthSession> | ApiError;
        if (response.statusCode >= 400 || !body.success) {
          if (
            [400, 401, 403].includes(response.statusCode) &&
            options.getSessionEpoch() === sessionEpoch &&
            options.getRefreshToken() === refreshToken
          ) {
            options.clear();
          }
          throw responseError(response, options.requestId(response.header));
        }

        if (options.getSessionEpoch() !== sessionEpoch || options.getRefreshToken() !== refreshToken) {
          throw new Error('登录状态已改变，请重新登录');
        }

        options.save(body.data);
        return body.data.accessToken;
      })
      .finally(() => {
        if (refreshInFlight?.promise === promise) refreshInFlight = undefined;
      });
    refreshInFlight = { epoch: sessionEpoch, refreshToken, promise };
    return promise;
  };
}
