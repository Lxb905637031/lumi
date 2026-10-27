import { useEffect, useMemo } from 'react';
import { Button, ScrollView, Text, View } from '@tarojs/components';
import type { ReactNode } from 'react';
import { createScrollLockController } from './scroll-lock';
import './ModalSheet.scss';

type ModalSheetProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

export function ModalSheet({ open, title, children, footer, onClose }: ModalSheetProps) {
  const scrollLock = useMemo(() => {
    if (typeof document === 'undefined') return createScrollLockController();
    return createScrollLockController({
      body: { style: document.body.style as unknown as Record<string, string> },
      getScrollY: () => window.scrollY,
      scrollTo: (x, y) => window.scrollTo(x, y),
    });
  }, []);

  useEffect(() => {
    if (open) scrollLock.lock();
    else scrollLock.unlock();
    return () => scrollLock.unlock();
  }, [open, scrollLock]);

  if (!open) return null;
  return (
    <View className="lumi-sheet" onClick={onClose} onTouchMove={(event) => event.stopPropagation()}>
      <View className="lumi-sheet__panel" onClick={(event) => event.stopPropagation()}>
        <View className="lumi-sheet__header">
          <Text className="lumi-sheet__title">{title}</Text>
          <Button className="lumi-sheet__close" plain aria-label="关闭" onClick={onClose}>
            ×
          </Button>
        </View>
        <ScrollView className="lumi-sheet__body" scrollY enhanced showScrollbar={false}>
          {children}
        </ScrollView>
        {footer && <View className="lumi-sheet__footer">{footer}</View>}
      </View>
    </View>
  );
}
