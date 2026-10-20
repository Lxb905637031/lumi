import { Text, View } from '@tarojs/components';
import type { HomeTab } from '../home.types';
import { AppIcon, type AppIconName } from '../../../components/ui/AppIcon/AppIcon';
import './BottomNavigation.scss';

const tabs: { label: HomeTab; icon: AppIconName }[] = [
  { label: '发现', icon: 'house' },
  { label: '衣橱', icon: 'shirt' },
  { label: '试穿', icon: 'grid-2x2' },
  { label: '我的', icon: 'user-round' },
];

type BottomNavigationProps = {
  activeTab: HomeTab;
  onChange: (tab: HomeTab) => void;
};

export function BottomNavigation({ activeTab, onChange }: BottomNavigationProps) {
  return (
    <View className="home-tabs" role="navigation" aria-label="主导航">
      {tabs.map((tab) => (
        <View
          key={tab.label}
          className={activeTab === tab.label ? 'home-tab home-tab-active' : 'home-tab'}
          onClick={() => onChange(tab.label)}
          role="button"
          aria-current={activeTab === tab.label ? 'page' : undefined}
        >
          <AppIcon name={tab.icon} active={activeTab === tab.label} />
          <Text className="home-tab-label">{tab.label}</Text>
        </View>
      ))}
    </View>
  );
}
