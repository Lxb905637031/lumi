import { Text, View } from '@tarojs/components';
import type { HomeTab } from '../home.types';
import './BottomNavigation.scss';

const tabs: HomeTab[] = ['发现', '衣橱', '试穿', '我的'];

type BottomNavigationProps = {
  activeTab: HomeTab;
  onChange: (tab: HomeTab) => void;
};

export function BottomNavigation({ activeTab, onChange }: BottomNavigationProps) {
  return (
    <View className="home-tabs" role="navigation" aria-label="主导航">
      {tabs.map((tab) => (
        <View
          key={tab}
          className={activeTab === tab ? 'home-tab home-tab-active' : 'home-tab'}
          onClick={() => onChange(tab)}
          role="button"
          aria-current={activeTab === tab ? 'page' : undefined}
        >
          <Text className="home-tab-label">{tab}</Text>
        </View>
      ))}
    </View>
  );
}
