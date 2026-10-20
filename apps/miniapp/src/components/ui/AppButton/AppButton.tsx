import type { ReactNode } from 'react';
import { Button } from '@tarojs/components';
import './AppButton.scss';

type AppButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  compact?: boolean;
  block?: boolean;
};

export function AppButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  compact = false,
  block = false,
}: AppButtonProps) {
  const sizeClass = compact ? 'lumi-button--compact' : block ? 'lumi-button--block' : '';
  return (
    <Button
      className={`lumi-button lumi-button--${variant} ${sizeClass}`.trim()}
      disabled={disabled || loading}
      loading={loading}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
