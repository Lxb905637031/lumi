import { View } from '@tarojs/components';
import { HomeHeader } from '../../features/home/components/HomeHeader';
import { WardrobeManager } from '../../features/wardrobe/components/WardrobeManager';
import '../index/index.scss';
export default function WardrobePage() {
  return (
    <View className="page">
      <HomeHeader activeTab="衣橱" />
      <WardrobeManager />
    </View>
  );
}
