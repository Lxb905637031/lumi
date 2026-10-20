type ErrorLike = {
  errMsg?: unknown;
  message?: unknown;
};

/**
 * Taro/微信 rejects native API calls with a plain object instead of Error.
 * Keep that diagnostic visible so the page can explain the actual failure.
 */
export function getAuthErrorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof Error && reason.message.trim()) return reason.message;
  if (typeof reason === 'string' && reason.trim()) return reason;
  if (typeof reason === 'object' && reason !== null) {
    const error = reason as ErrorLike;
    if (typeof error.message === 'string' && error.message.trim()) return error.message;
    if (typeof error.errMsg === 'string' && error.errMsg.trim()) return `微信接口错误：${error.errMsg}`;
  }
  return fallback;
}
