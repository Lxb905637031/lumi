export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: string,
    readonly requestId?: string,
  ) {
    super(requestId ? `${message}（请求编号 ${requestId}）` : message);
    this.name = 'ApiRequestError';
  }
}
