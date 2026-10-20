import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiRequestError } from '../src/services/api-request-error';

test('API request errors preserve a support request ID in the user-facing message', () => {
  const error = new ApiRequestError('服务暂时不可用', 503, 'SERVICE_UNAVAILABLE', 'req-123');

  assert.equal(error.statusCode, 503);
  assert.equal(error.code, 'SERVICE_UNAVAILABLE');
  assert.equal(error.requestId, 'req-123');
  assert.match(error.message, /请求编号 req-123/);
});

test('API request errors without a server response do not invent a request ID', () => {
  const error = new ApiRequestError('网络连接失败', 0);

  assert.equal(error.requestId, undefined);
  assert.equal(error.message, '网络连接失败');
});
