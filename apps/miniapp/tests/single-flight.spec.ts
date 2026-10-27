import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SingleFlight } from '../src/services/single-flight';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

test('concurrent callers share one operation and a later call can run again', async () => {
  const flight = new SingleFlight<string>();
  const pending = deferred<string>();
  let calls = 0;
  const first = flight.run(async () => {
    calls += 1;
    return pending.promise;
  });
  const second = flight.run(async () => {
    calls += 1;
    return 'unexpected';
  });

  assert.equal(calls, 1);
  pending.resolve('ready');
  assert.deepEqual(await Promise.all([first, second]), ['ready', 'ready']);
  assert.equal(await flight.run(async () => 'next'), 'next');
});

test('a rejected operation is not cached and can be retried', async () => {
  const flight = new SingleFlight<string>();
  await assert.rejects(
    flight.run(async () => Promise.reject(new Error('offline'))),
    /offline/,
  );
  assert.equal(await flight.run(async () => 'recovered'), 'recovered');
});
