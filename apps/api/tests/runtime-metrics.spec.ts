import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RuntimeMetricsService } from '../src/common/runtime-metrics.service';

test('runtime metrics use bounded status groups and latency buckets', () => {
  const metrics = new RuntimeMetricsService();
  metrics.recordHttp(200, 7);
  metrics.recordHttp(404, 49);
  metrics.recordHttp(503, 6001);
  const snapshot = metrics.snapshot();
  assert.equal(snapshot.scope, 'process-local');
  assert.equal(snapshot.http.requests, 3);
  assert.deepEqual(snapshot.http.byStatusGroup, { '2xx': 1, '4xx': 1, '5xx': 1 });
  assert.deepEqual(snapshot.http.latencyMs.buckets, {
    10: 1,
    25: 0,
    50: 1,
    100: 0,
    250: 0,
    500: 0,
    1000: 0,
    2500: 0,
    5000: 0,
  });
  assert.equal(snapshot.http.latencyMs.overflow, 1);
});

test('runtime queue metrics aggregate only fixed queue and outcome labels', () => {
  const metrics = new RuntimeMetricsService();
  metrics.recordQueue('generation', 'started');
  metrics.recordQueue('generation', 'succeeded');
  metrics.recordQueue('announcement-delivery', 'retrying');
  assert.deepEqual(metrics.snapshot().queues, {
    'announcement-delivery:retrying': 1,
    'generation:started': 1,
    'generation:succeeded': 1,
  });
});
