import { View } from '@tarojs/components';
import { HomeHeader } from '../../features/home/components/HomeHeader';
import { InspirationGrid } from '../../features/feed/components/InspirationGrid';
import './index.scss';

export default function Index() {
  return (
    <View className="page">
      <HomeHeader activeTab="发现" />
      <InspirationGrid />
    </View>
  );
}
