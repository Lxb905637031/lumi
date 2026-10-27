export type ScrollLockController = {
  lock(): void;
  unlock(): void;
};

export function createScrollLockController(
  target: {
    body?: { style: Record<string, string> };
    scrollY?: number;
    getScrollY?: () => number;
    scrollTo?: (x: number, y: number) => void;
  } = {},
): ScrollLockController {
  let previousScrollY = target.scrollY ?? 0;
  let locked = false;

  return {
    lock() {
      if (locked) return;
      locked = true;
      previousScrollY = target.getScrollY?.() ?? target.scrollY ?? 0;
      if (!target.body) return;
      target.body.style.position = 'fixed';
      target.body.style.top = `-${previousScrollY}px`;
      target.body.style.width = '100%';
      target.body.style.overflow = 'hidden';
    },
    unlock() {
      if (!locked) return;
      locked = false;
      if (!target.body) return;
      target.body.style.position = '';
      target.body.style.top = '';
      target.body.style.width = '';
      target.body.style.overflow = '';
      target.scrollTo?.(0, previousScrollY);
    },
  };
}
