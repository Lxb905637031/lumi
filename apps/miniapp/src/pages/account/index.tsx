import { View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { HomeHeader } from '../../features/home/components/HomeHeader';
import { ProfilePanel } from '../../features/profile/components/ProfilePanel';
import '../index/index.scss';

export default function AccountPage() {
  return (
    <View className="page">
      <HomeHeader activeTab="我的" />
      <ProfilePanel onStartTryOn={() => void Taro.switchTab({ url: '/pages/try-on/index' })} />
    </View>
  );
}
