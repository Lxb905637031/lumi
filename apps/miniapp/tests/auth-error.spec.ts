import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAuthErrorMessage } from '../src/features/auth/auth-error';
import { PRIVACY_CONFIRM_TEXT } from '../src/features/auth/auth-constants';

test('privacy consent confirm text stays within the WeChat four-character limit', () => {
  assert.ok(PRIVACY_CONFIRM_TEXT.length <= 4);
});

test('native WeChat error objects remain diagnosable on the profile page', () => {
  assert.equal(
    getAuthErrorMessage({ errMsg: 'showModal:fail confirmText length exceeds 4' }, '登录失败'),
    '微信接口错误：showModal:fail confirmText length exceeds 4',
  );
  assert.equal(getAuthErrorMessage(new Error('接口不可用'), '登录失败'), '接口不可用');
  assert.equal(getAuthErrorMessage({}, '登录失败'), '登录失败');
});
