import { Image } from '@tarojs/components';
import './AppIcon.scss';

export type AppIconName =
  | 'house'
  | 'shirt'
  | 'grid-2x2'
  | 'user-round'
  | 'bell'
  | 'chevron-right'
  | 'lock-keyhole'
  | 'bookmark'
  | 'clock'
  | 'shield-check'
  | 'plus'
  | 'check';

export function AppIcon({ name, active = false }: { name: AppIconName; active?: boolean }) {
  return (
    <Image
      className="lumi-icon"
      src={`/assets/icons/${name}-${active ? 'active' : 'default'}.png`}
      mode="aspectFit"
      aria-hidden
    />
  );
}
