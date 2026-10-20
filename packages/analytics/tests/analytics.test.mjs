import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnalyticsClient } from '../src/index.ts';

test('analytics is denied until consent is explicitly granted', async () => {
  const events = [];
  let hasConsent = false;
  const client = createAnalyticsClient({ hasConsent: () => hasConsent, sink: (event) => events.push(event) });

  assert.equal(await client.track('app.opened', { entry: 'tab' }), false);
  assert.deepEqual(events, []);

  hasConsent = true;
  assert.equal(await client.track('app.opened', { entry: 'tab' }), true);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'app.opened');
});

test('event timestamps use the injected clock and sink failures are visible', async () => {
  const eventTime = new Date('2026-10-20T00:00:00.000Z');
  const events = [];
  const client = createAnalyticsClient({
    hasConsent: () => true,
    sink: (event) => events.push(event),
    now: () => eventTime,
  });

  await client.track('try_on.failed', { reason: 'provider' });
  assert.equal(events[0].occurredAt, eventTime.toISOString());

  const failing = createAnalyticsClient({
    hasConsent: () => true,
    sink: () => {
      throw new Error('sink unavailable');
    },
  });
  await assert.rejects(() => failing.track('app.opened', { entry: 'tab' }), /sink unavailable/);
});
