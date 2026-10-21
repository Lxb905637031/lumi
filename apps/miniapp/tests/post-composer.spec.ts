import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CommunityPost, CreateCommunityPostInput } from '@lumi/contracts';
import {
  PostComposerWorkflow,
  type ComposerApi,
  type PostSource,
} from '../src/features/community/post-composer-workflow';
import { ApiRequestError } from '../src/services/api-request-error';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((ok) => {
    resolve = ok;
  });
  return { promise, resolve };
}
function fixture(source?: PostSource) {
  let epoch = 0;
  let keys = 0;
  const calls: CreateCommunityPostInput[] = [];
  const post = { id: 'post1', moderationStatus: 'PENDING' } as CommunityPost;
  const api: ComposerApi = {
    login: async () => {},
    sessionEpoch: () => epoch,
    key: () => `request-${++keys}`,
    choose: async () => ['image1'],
    upload: async (path) => ({ id: path, preview: path }),
    source: async () => ({ id: 'result1', preview: 'private-url' }),
    confirm: async () => true,
    create: async (input) => {
      calls.push(structuredClone(input));
      return post;
    },
  };
  const flow = new PostComposerWorkflow(api, source);
  async function prepare() {
    await flow.prepare();
    flow.edit({ title: ' My title ', body: ' My body ', topic: ' ' });
    if (!source) await flow.addImages();
  }
  return {
    api,
    flow,
    calls,
    post,
    prepare,
    changeSession: () => {
      epoch += 1;
    },
  };
}

test('explicit preparation and required fields precede any publication', async () => {
  const f = fixture();
  f.flow.edit({ title: 'ignored' });
  await f.flow.submit();
  assert.equal(f.flow.snapshot().draft.title, '');
  await f.flow.prepare();
  await f.flow.submit();
  assert.equal(f.calls.length, 0);
  assert.match(f.flow.snapshot().error!, /标题/);
});
test('first interactive login can establish a session before editing', async () => {
  const f = fixture();
  f.api.login = async () => f.changeSession();
  await f.prepare();
  assert.equal(f.flow.snapshot().ready, true);
  assert.equal(f.flow.snapshot().draft.assets.length, 1);
});
test('partial upload failures preserve fields and successes, retry only remaining files', async () => {
  const f = fixture();
  await f.flow.prepare();
  f.flow.edit({ title: 'Keep me' });
  f.api.choose = async () => ['image1', 'image2', 'image3'];
  let fail = true;
  const uploads: string[] = [];
  f.api.upload = async (path) => {
    uploads.push(path);
    if (path === 'image2' && fail) throw new Error('offline');
    return { id: path, preview: path };
  };
  await f.flow.addImages();
  assert.equal(f.flow.snapshot().draft.assets.length, 1);
  assert.equal(f.flow.snapshot().remainingUploads, 2);
  assert.equal(f.flow.snapshot().draft.title, 'Keep me');
  fail = false;
  await f.flow.addImages();
  assert.deepEqual(uploads, ['image1', 'image2', 'image2', 'image3']);
  assert.equal(f.flow.snapshot().remainingUploads, 0);
});
test('upload progress is visible while a file is being transferred and is cleared after success', async () => {
  const f = fixture();
  await f.flow.prepare();
  f.api.choose = async () => ['image1'];
  const pending = deferred<{ id: string; preview: string }>();
  f.api.upload = async (_path, onProgress) => {
    onProgress?.({ phase: 'uploading', percent: 42 });
    return pending.promise;
  };
  const upload = f.flow.addImages();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.flow.snapshot().uploadProgress, { phase: 'uploading', percent: 42 });
  pending.resolve({ id: 'image1', preview: 'image1' });
  await upload;
  assert.equal(f.flow.snapshot().uploadProgress, undefined);
  assert.equal(f.flow.snapshot().remainingUploads, 0);
});
test('public scope confirmation rejection writes nothing; double clicks publish once', async () => {
  const f = fixture();
  await f.prepare();
  f.api.confirm = async () => false;
  await f.flow.submit();
  assert.equal(f.calls.length, 0);
  const pending = deferred<CommunityPost>();
  f.api.confirm = async () => true;
  f.api.create = async (input) => {
    f.calls.push(input);
    return pending.promise;
  };
  const sending = f.flow.submit();
  await f.flow.submit();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.calls.length, 1);
  pending.resolve(f.post);
  await sending;
  assert.equal(f.calls[0]?.title, 'My title');
  assert.equal(f.flow.snapshot().post?.id, 'post1');
});
test('lost response freezes original content/key and recovers without a second confirmation', async () => {
  const f = fixture();
  await f.prepare();
  let confirms = 0;
  f.api.confirm = async () => {
    confirms += 1;
    return true;
  };
  f.api.create = async (input) => {
    f.calls.push(structuredClone(input));
    throw new Error('response lost');
  };
  await f.flow.submit();
  assert.ok(f.flow.snapshot().pending);
  f.flow.edit({ title: 'cannot change' });
  f.flow.removeAsset('image1');
  assert.equal(f.flow.snapshot().draft.title, ' My title ');
  assert.equal(f.flow.snapshot().draft.assets.length, 1);
  f.flow.leave();
  f.flow.resume();
  f.api.create = async (input) => {
    f.calls.push(input);
    return f.post;
  };
  await f.flow.submit();
  assert.deepEqual(f.calls[0], f.calls[1]);
  assert.equal(confirms, 1);
});
test('first definitive rejection permits editing, but 401 after an unknown attempt retains recovery intent', async () => {
  const f = fixture();
  await f.prepare();
  f.api.create = async () => {
    throw new ApiRequestError('invalid image', 404);
  };
  await f.flow.submit();
  assert.equal(f.flow.snapshot().pending, undefined);
  f.flow.edit({ title: 'Corrected' });
  f.api.create = async () => {
    throw new Error('unknown');
  };
  await f.flow.submit();
  const original = f.flow.snapshot().pending;
  f.api.create = async () => {
    throw new ApiRequestError('expired', 401);
  };
  await f.flow.submit();
  assert.deepEqual(f.flow.snapshot().pending, original);
});
test('leaving before confirmation prevents a write; leaving after sending keeps an intent but drops stale success', async () => {
  const f = fixture();
  await f.prepare();
  const confirm = deferred<boolean>();
  f.api.confirm = () => confirm.promise;
  const confirming = f.flow.submit();
  f.flow.leave();
  confirm.resolve(true);
  await confirming;
  assert.equal(f.calls.length, 0);
  f.flow.resume();
  f.api.confirm = async () => true;
  const response = deferred<CommunityPost>();
  f.api.create = () => response.promise;
  const sending = f.flow.submit();
  await new Promise((resolve) => setImmediate(resolve));
  f.flow.leave();
  response.resolve(f.post);
  await sending;
  assert.equal(f.flow.snapshot().post, undefined);
  assert.ok(f.flow.snapshot().pending);
});
test('session switch wipes private draft and rejects the old asynchronous response', async () => {
  const f = fixture();
  await f.prepare();
  const response = deferred<CommunityPost>();
  f.api.create = () => response.promise;
  const sending = f.flow.submit();
  await new Promise((resolve) => setImmediate(resolve));
  f.changeSession();
  f.flow.resume();
  response.resolve(f.post);
  await sending;
  assert.equal(f.flow.snapshot().ready, false);
  assert.equal(f.flow.snapshot().draft.assets.length, 0);
  assert.equal(f.flow.snapshot().pending, undefined);
  assert.equal(f.flow.snapshot().post, undefined);
});
test('generated source is revalidated, cannot be removed, and always declares generated content', async () => {
  const f = fixture({ jobId: 'job', outputId: 'output' });
  await f.prepare();
  f.flow.removeAsset('result1');
  assert.equal(f.flow.snapshot().draft.assets.length, 1);
  f.api.source = async () => {
    throw new Error('result deleted');
  };
  await f.flow.submit();
  assert.equal(f.calls.length, 0);
  f.api.source = async () => ({ id: 'result1', preview: 'renewed-private-url' });
  await f.flow.submit();
  assert.equal(f.calls[0]?.isAiGenerated, true);
  assert.deepEqual(f.calls[0]?.imageAssetIds, ['result1']);
});
test('only an explicit new-draft action clears a successful post and allocates another intent', async () => {
  const f = fixture();
  await f.prepare();
  await f.flow.submit();
  await f.flow.submit();
  assert.equal(f.calls.length, 1);
  f.flow.newDraft();
  await f.prepare();
  await f.flow.submit();
  assert.equal(f.calls.length, 2);
  assert.notEqual(f.calls[0]?.idempotencyKey, f.calls[1]?.idempotencyKey);
});
