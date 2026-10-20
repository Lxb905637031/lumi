import { View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { HomeHeader } from '../../features/home/components/HomeHeader';
import { QuickTryOnPanel } from '../../features/try-on/components/QuickTryOnPanel';
import '../index/index.scss';

export default function TryOnPage() {
  return (
    <View className="page">
      <HomeHeader activeTab="试穿" />
      <QuickTryOnPanel onGoProfile={() => void Taro.navigateTo({ url: '/pages/profiles/index' })} />
    </View>
  );
}
