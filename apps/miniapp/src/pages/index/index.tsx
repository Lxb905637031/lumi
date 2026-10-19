import { useState } from 'react';
import { View } from '@tarojs/components';
import { BottomNavigation } from '../../features/home/components/BottomNavigation';
import { HomeHeader } from '../../features/home/components/HomeHeader';
import type { HomeTab } from '../../features/home/home.types';
import { InspirationGrid } from '../../features/feed/components/InspirationGrid';
import { ProfilePanel } from '../../features/profile/components/ProfilePanel';
import { QuickTryOnPanel } from '../../features/try-on/components/QuickTryOnPanel';
import './index.scss';

export default function Index() {
  const [activeTab, setActiveTab] = useState<HomeTab>('推荐');

  return (
    <View className="page">
      <HomeHeader />
      <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === '推荐' && <InspirationGrid />}
      {activeTab === '试穿' && <QuickTryOnPanel onGoProfile={() => setActiveTab('我的')} />}
      {activeTab === '我的' && <ProfilePanel onStartTryOn={() => setActiveTab('试穿')} />}
    </View>
  );
}
