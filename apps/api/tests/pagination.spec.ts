import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { decodeTimestampCursor, encodeTimestampCursor } from '../src/common/pagination/pagination';
import { validateEnvironment } from '../src/config/env';

test('timestamp cursors round-trip with stable identifiers', () => {
  const cursor = { timestamp: '2026-10-18T10:00:00.000Z', id: 'profile-42' };
  assert.deepEqual(decodeTimestampCursor(encodeTimestampCursor(cursor)), cursor);
});

test('malformed timestamp cursors are rejected as client errors', () => {
  assert.throws(
    () => decodeTimestampCursor('not-a-cursor'),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.equal(error.getStatus(), 400);
      return true;
    },
  );
});

test('missing cursors represent the first page', () => {
  assert.equal(decodeTimestampCursor(undefined), undefined);
});

test('production configuration rejects FREE_MODE', () => {
  assert.throws(
    () =>
      validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://lumi:secret@localhost:5432/lumi',
        JWT_ACCESS_SECRET: 'a-production-secret-longer-than-thirty-two-characters',
        FREE_MODE: 'true',
        CORS_ORIGINS: 'https://lumi.example.com',
      }),
    /FREE_MODE must be disabled in production/,
  );
});

test('production configuration requires an explicit CORS allowlist', () => {
  assert.throws(
    () =>
      validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://lumi:secret@localhost:5432/lumi',
        JWT_ACCESS_SECRET: 'a-production-secret-longer-than-thirty-two-characters',
        FREE_MODE: 'false',
        WECHAT_APP_ID: 'wx-app-id',
        WECHAT_APP_SECRET: 'wx-app-secret',
      }),
    /CORS_ORIGINS must be configured in production/,
  );
});

test('production configuration rejects local admin identifiers', () => {
  assert.throws(
    () =>
      validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://lumi:secret@localhost:5432/lumi',
        JWT_ACCESS_SECRET: 'a-production-secret-longer-than-thirty-two-characters',
        FREE_MODE: 'false',
        WECHAT_APP_ID: 'wx-app-id',
        WECHAT_APP_SECRET: 'wx-app-secret',
        CORS_ORIGINS: 'https://lumi.example.com',
        LOCAL_ADMIN_OPEN_IDS: 'admin-local',
      }),
    /LOCAL_ADMIN_OPEN_IDS is only allowed outside production/,
  );
});
