import assert from 'node:assert/strict';
import test from 'node:test';
import { createScrollLockController } from '../src/components/ui/ModalSheet/scroll-lock';

test('scroll lock locks the background and restores its exact scroll position', () => {
  const style: Record<string, string> = {};
  const scrolls: number[] = [];
  const controller = createScrollLockController({
    body: { style },
    scrollY: 248,
    scrollTo: (_x, y) => scrolls.push(y),
  });

  controller.lock();
  assert.equal(style.position, 'fixed');
  assert.equal(style.top, '-248px');
  controller.lock();
  controller.unlock();
  assert.equal(style.position, '');
  assert.deepEqual(scrolls, [248]);
});

test('scroll lock is safe for the native runtime without a document', () => {
  const controller = createScrollLockController();
  assert.doesNotThrow(() => controller.lock());
  assert.doesNotThrow(() => controller.unlock());
});

test('scroll lock captures the current position when opened, not when the controller was created', () => {
  const style: Record<string, string> = {};
  const scrolls: number[] = [];
  let currentScrollY = 0;
  const controller = createScrollLockController({
    body: { style },
    getScrollY: () => currentScrollY,
    scrollTo: (_x, y) => scrolls.push(y),
  });

  currentScrollY = 684;
  controller.lock();
  assert.equal(style.top, '-684px');
  controller.unlock();

  assert.deepEqual(scrolls, [684]);
});
