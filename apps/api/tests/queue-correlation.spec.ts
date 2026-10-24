import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ensureRequestId, requestId } from '../src/common/api-response';
import { queueEvent, safeErrorCode } from '../src/common/queue-logging';

test('HTTP request ID is stable between controller dispatch and response envelope', () => {
  const request = { headers: { 'x-request-id': 'client-req-123' } };
  const headers: Record<string, string> = {};
  const id = ensureRequestId(request as never);
  assert.equal(id, 'client-req-123');
  assert.equal(
    requestId(request as never, { header: (name: string, value: string) => (headers[name] = value) } as never),
    id,
  );
  assert.equal(headers['x-request-id'], id);
});

test('invalid client request IDs are replaced with a bounded generated ID', () => {
  const request = { headers: { 'x-request-id': 'bad request id' } };
  const id = ensureRequestId(request as never);
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.equal(ensureRequestId(request as never), id);
});

test('queue event keeps correlation fields and excludes arbitrary payload data', () => {
  const event = queueEvent({
    event: 'queue.process.failed',
    queue: 'generation',
    bullJobId: 'bull-123',
    requestId: 'req-123',
    workflowId: 'job-123',
    attempt: 2,
    outcome: 'retrying',
    errorCode: 'GENERATION_TIMEOUT',
  });
  assert.deepEqual(JSON.parse(event), {
    event: 'queue.process.failed',
    queue: 'generation',
    bullJobId: 'bull-123',
    requestId: 'req-123',
    workflowId: 'job-123',
    attempt: 2,
    outcome: 'retrying',
    errorCode: 'GENERATION_TIMEOUT',
  });
  assert.doesNotMatch(event, /title|body|token|image|password|payload/);
});

test('queue event marks recovery records without inventing an HTTP request ID', () => {
  const event = JSON.parse(
    queueEvent({ event: 'queue.recovery.redispatch-deferred', queue: 'generation', workflowId: 'job-1' }),
  );
  assert.equal(event.requestId, 'legacy-or-recovery');
  assert.equal(event.workflowId, 'job-1');
});

test('queue error codes are bounded and do not leak exception messages', () => {
  const error = new Error('secret user image URL and bearer token');
  error.name = 'GENERATION_TIMEOUT';
  assert.equal(safeErrorCode(error), 'GENERATION_TIMEOUT');
  const unsafe = new Error('not emitted');
  unsafe.name = 'bad error name with spaces';
  assert.equal(safeErrorCode(unsafe), 'QUEUE_PROCESSING_ERROR');
});
