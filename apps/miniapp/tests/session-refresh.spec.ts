import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ApiSuccess, AuthSession } from '@lumi/contracts';
import { createSessionRefreshCoordinator } from '../src/services/session-refresh';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function fixture() {
  let refreshToken = 'refresh-old';
  let epoch = 0;
  const saved: AuthSession[] = [];
  let clears = 0;
  const pending = deferred<{
    statusCode: number;
    data: ApiSuccess<AuthSession>;
  }>();
  let calls = 0;
  const refresh = createSessionRefreshCoordinator({
    getRefreshToken: () => refreshToken,
    getSessionEpoch: () => epoch,
    refresh: async () => {
      calls += 1;
      return pending.promise;
    },
    save: (session) => {
      saved.push(session);
      refreshToken = session.refreshToken;
    },
    clear: () => {
      clears += 1;
      refreshToken = '';
      epoch += 1;
    },
    requestId: () => undefined,
  });

  return {
    refresh,
    pending,
    saved,
    calls: () => calls,
    clears: () => clears,
    logout: () => {
      refreshToken = '';
      epoch += 1;
    },
    switchAccount: () => {
      refreshToken = 'refresh-new-account';
      epoch += 1;
    },
  };
}

function successfulResponse(): { statusCode: number; data: ApiSuccess<AuthSession> } {
  return {
    statusCode: 200,
    data: {
      success: true,
      code: 'OK',
      message: 'OK',
      data: {
        accessToken: 'access-refreshed',
        refreshToken: 'refresh-rotated',
        refreshTokenExpiresAt: '2030-02-01T00:00:00.000Z',
        user: { id: 'user-old', openId: 'test-open-id', role: 'USER' },
        freeMode: true,
      },
      meta: { requestId: 'refresh-request', timestamp: '2030-01-01T00:00:00.000Z' },
    },
  };
}

test('parallel expired requests share one refresh and rotate the session once', async () => {
  const f = fixture();
  const first = f.refresh();
  const second = f.refresh();
  assert.equal(f.calls(), 1);

  f.pending.resolve(successfulResponse());
  assert.deepEqual(await Promise.all([first, second]), ['access-refreshed', 'access-refreshed']);
  assert.equal(f.saved.length, 1);
  assert.equal(f.saved[0]?.refreshToken, 'refresh-rotated');
});

test('late refresh response after logout cannot restore the old session', async () => {
  const f = fixture();
  const refreshing = f.refresh();
  f.logout();
  f.pending.resolve(successfulResponse());

  await assert.rejects(refreshing, /登录状态已改变/);
  assert.equal(f.saved.length, 0);
  assert.equal(f.clears(), 0);
});

test('late refresh response after account switch cannot overwrite the new session', async () => {
  const f = fixture();
  const refreshing = f.refresh();
  f.switchAccount();
  f.pending.resolve(successfulResponse());

  await assert.rejects(refreshing, /登录状态已改变/);
  assert.equal(f.saved.length, 0);
  assert.equal(f.clears(), 0);
});
