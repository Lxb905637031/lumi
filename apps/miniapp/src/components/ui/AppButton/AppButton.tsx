import type { ReactNode } from 'react';
import { Button } from '@tarojs/components';
import './AppButton.scss';

type AppButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
};

export function AppButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
}: AppButtonProps) {
  return (
    <Button
      className={`lumi-button lumi-button--${variant}`}
      disabled={disabled || loading}
      loading={loading}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
