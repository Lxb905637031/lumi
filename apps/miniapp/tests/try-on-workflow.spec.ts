import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BodyProfile, ClothingItem, CreateGenerationInput, GenerationJob, QuotaSummary } from '@lumi/contracts';
import { TryOnWorkflow, type TryOnApi } from '../src/features/try-on/try-on-workflow';
import { ApiRequestError } from '../src/services/api-request-error';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, no) => {
    resolve = ok;
    reject = no;
  });
  return { promise, resolve, reject };
}

function fixture() {
  const profile: BodyProfile = {
    id: 'p1',
    userId: 'u1',
    name: 'My profile',
    activeVersion: 2,
    createdAt: '',
    updatedAt: '',
    versions: [
      {
        id: 'v2',
        profileId: 'p1',
        version: 2,
        sourceAssetId: 'photo1',
        measurements: { heightCm: 170, weightKg: 60 },
        createdAt: '',
      },
    ],
  };
  const clothing: ClothingItem = {
    id: 'c1',
    userId: 'u1',
    name: 'Shirt',
    category: 'TOP',
    assetId: 'photo2',
    createdAt: '',
    updatedAt: '',
  };
  const job: GenerationJob = {
    id: 'j1',
    status: 'QUEUED',
    provider: 'local-svg',
    retryCount: 0,
    errorCode: null,
    nextAttemptAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: '',
    updatedAt: '',
    outputs: [],
  };
  const quota: QuotaSummary = {
    available: 5,
    reserved: 0,
    consumed: 0,
    granted: 5,
    policyVersion: 'free-trial-v1',
    costPerGeneration: 1,
  };
  let epoch = 0;
  let keyCount = 0;
  const calls = { creates: [] as CreateGenerationInput[], retries: 0, reads: 0, confirms: 0 };
  const api: TryOnApi = {
    login: async () => {},
    sessionEpoch: () => epoch,
    profiles: async () => ({ items: [profile], nextCursor: 'profiles-2' }),
    clothing: async () => ({ items: [clothing], nextCursor: 'clothes-2' }),
    quota: async () => ({ ...quota }),
    create: async (input) => {
      calls.creates.push({ ...input });
      return { ...job };
    },
    read: async () => {
      calls.reads += 1;
      return { ...job };
    },
    retry: async () => {
      calls.retries += 1;
      return { ...job, status: 'QUEUED' };
    },
    cancel: async () => ({ ...job, status: 'CANCELLED' }),
    confirm: async () => {
      calls.confirms += 1;
      return true;
    },
    key: () => 'key-' + ++keyCount,
  };
  const flow = new TryOnWorkflow(api);
  async function select() {
    await flow.prepare();
    flow.selectProfile('v2');
    flow.selectClothing('c1');
  }
  return {
    flow,
    api,
    calls,
    profile,
    clothing,
    job,
    quota,
    select,
    changeSession: () => {
      epoch += 1;
    },
  };
}

test('input choices are explicit; missing selections/photos never create a task', async () => {
  const f = fixture();
  await f.flow.prepare();
  assert.equal(f.flow.snapshot().profileVersionId, undefined);
  await f.flow.start();
  assert.equal(f.calls.creates.length, 0);
  f.flow.selectProfile('v2');
  f.flow.selectClothing('c1');
  f.profile.versions[0]!.sourceAssetId = null;
  await f.flow.start();
  assert.equal(f.calls.creates.length, 0);
  assert.match(f.flow.snapshot().error!, /人物照/);
});

test('cursor loading deduplicates and does not silently select a different item', async () => {
  const f = fixture();
  await f.select();
  f.api.clothing = async (cursor) => {
    assert.equal(cursor, 'clothes-2');
    return { items: [f.clothing, { ...f.clothing, id: 'c2' }], nextCursor: null };
  };
  await f.flow.more('clothing');
  assert.equal(f.flow.snapshot().clothing.length, 2);
  assert.equal(f.flow.snapshot().clothingId, 'c1');
});

test('confirmation rejection or zero quota prevents writes and does not allocate a pending request', async () => {
  const f = fixture();
  await f.select();
  f.api.confirm = async () => false;
  await f.flow.start();
  assert.equal(f.flow.snapshot().pendingInput, undefined);
  f.quota.available = 0;
  await f.flow.start();
  assert.equal(f.calls.creates.length, 0);
  assert.match(f.flow.snapshot().error!, /额度不足/);
});

test('network-unknown creation preserves the exact input/key; continuation works even if quota is reserved', async () => {
  const f = fixture();
  await f.select();
  const originalCreate = f.api.create;
  f.api.create = async (input) => {
    f.calls.creates.push({ ...input });
    throw new Error('network disconnected');
  };
  await f.flow.start();
  const pending = f.flow.snapshot().pendingInput;
  assert.ok(pending);
  f.flow.selectProfile('other');
  f.flow.selectClothing('other');
  f.api.create = originalCreate;
  f.quota.available = 0;
  f.quota.reserved = 1;
  await f.flow.start();
  assert.deepEqual(f.calls.creates[0], f.calls.creates[1]);
  assert.equal(f.calls.confirms, 1);
  assert.equal(f.flow.snapshot().job?.id, 'j1');
});

test('quota read failure does not discard an unknown original request', async () => {
  const f = fixture();
  await f.select();
  f.api.create = async () => {
    throw new Error('unknown');
  };
  await f.flow.start();
  const pending = f.flow.snapshot().pendingInput;
  f.api.quota = async () => {
    throw new ApiRequestError('temporarily unavailable', 404);
  };
  await f.flow.start();
  assert.deepEqual(f.flow.snapshot().pendingInput, pending);
});

test('definitive quota exhaustion clears an uncreated intent, but a queue 503 keeps its persisted request', async () => {
  const f = fixture();
  await f.select();
  f.api.create = async () => {
    throw new ApiRequestError('quota exhausted', 409, 'FREE_QUOTA_EXHAUSTED');
  };
  await f.flow.start();
  assert.equal(f.flow.snapshot().pendingInput, undefined);
  f.api.create = async () => {
    throw new ApiRequestError('queue unavailable', 503);
  };
  await f.flow.start();
  assert.ok(f.flow.snapshot().pendingInput);
});

test('double clicks create once; active tasks are queried, never manually retried', async () => {
  const f = fixture();
  await f.select();
  const pending = deferred<GenerationJob>();
  f.api.create = async (input) => {
    f.calls.creates.push(input);
    return pending.promise;
  };
  const one = f.flow.start();
  const two = f.flow.start();
  await new Promise((resolve) => setImmediate(resolve));
  pending.resolve(f.job);
  await Promise.all([one, two]);
  assert.equal(f.calls.creates.length, 1);
  await f.flow.retry();
  await f.flow.start();
  assert.equal(f.calls.retries, 0);
  assert.equal(f.calls.creates.length, 1);
  await f.flow.refreshJob();
  assert.equal(f.calls.reads, 1);
});

test('cancellation remains available during polling; late reads cannot resurrect a cancelled task', async () => {
  const f = fixture();
  await f.select();
  await f.flow.start();
  const read = deferred<GenerationJob>();
  f.api.read = () => read.promise;
  const polling = f.flow.refreshJob();
  await f.flow.cancel();
  read.resolve({ ...f.job, status: 'RUNNING' });
  await polling;
  assert.equal(f.flow.snapshot().job?.status, 'CANCELLED');
  assert.equal(f.flow.snapshot().pendingInput, undefined);
});

test('leaving during confirmation prevents a new task; leaving during a sent request retains recovery input', async () => {
  const f = fixture();
  await f.select();
  const confirmation = deferred<boolean>();
  f.api.confirm = () => confirmation.promise;
  const starting = f.flow.start();
  await new Promise((resolve) => setImmediate(resolve));
  f.flow.leave();
  confirmation.resolve(true);
  await starting;
  assert.equal(f.calls.creates.length, 0);
  f.api.confirm = async () => true;
  const pending = deferred<GenerationJob>();
  f.api.create = () => pending.promise;
  const sending = f.flow.start();
  await new Promise((resolve) => setImmediate(resolve));
  f.flow.leave();
  pending.resolve(f.job);
  await sending;
  assert.equal(f.flow.snapshot().job, undefined);
  assert.ok(f.flow.snapshot().pendingInput);
  assert.equal(f.flow.snapshot().busy, false);
});

test('session switch discards inputs and ignores old in-flight task results', async () => {
  const f = fixture();
  await f.select();
  const pending = deferred<GenerationJob>();
  f.api.create = () => pending.promise;
  const sending = f.flow.start();
  await new Promise((resolve) => setImmediate(resolve));
  f.changeSession();
  f.flow.resetForSession();
  pending.resolve(f.job);
  await sending;
  assert.equal(f.flow.snapshot().job, undefined);
  assert.equal(f.flow.snapshot().profiles.length, 0);
  assert.equal(f.flow.snapshot().pendingInput, undefined);
});

test('failed-task retry rechecks quota and confirms; cancelling/success permits a distinct new request', async () => {
  const f = fixture();
  await f.select();
  f.job.status = 'FAILED';
  await f.flow.start();
  f.quota.available = 0;
  await f.flow.retry();
  assert.equal(f.calls.retries, 0);
  f.quota.available = 5;
  await f.flow.retry();
  assert.equal(f.calls.retries, 1);
  await f.flow.cancel();
  f.job.status = 'SUCCEEDED';
  await f.flow.start();
  assert.notEqual(f.calls.creates[0]?.idempotencyKey, f.calls.creates[1]?.idempotencyKey);
});
