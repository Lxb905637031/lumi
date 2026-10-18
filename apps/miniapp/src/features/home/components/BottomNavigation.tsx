import { Text, View } from '@tarojs/components';
import type { HomeTab } from '../home.types';
import './BottomNavigation.scss';

const tabs: HomeTab[] = ['推荐', '试穿', '我的'];

type BottomNavigationProps = {
  activeTab: HomeTab;
  onChange: (tab: HomeTab) => void;
};

export function BottomNavigation({ activeTab, onChange }: BottomNavigationProps) {
  return (
    <View className="home-tabs">
      {tabs.map((tab) => (
        <Text
          key={tab}
          className={activeTab === tab ? 'home-tab home-tab-active' : 'home-tab'}
          onClick={() => onChange(tab)}
        >
          {tab}
        </Text>
      ))}
    </View>
  );
}
