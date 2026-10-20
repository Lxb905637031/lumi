import { View } from '@tarojs/components';
import { HomeHeader } from '../../features/home/components/HomeHeader';
import { InspirationGrid } from '../../features/feed/components/InspirationGrid';
import { HomeWardrobeSummary } from '../../features/home/components/HomeWardrobeSummary';
import './index.scss';

export default function Index() {
  return (
    <View className="page">
      <HomeHeader activeTab="发现" />
      <HomeWardrobeSummary />
      <InspirationGrid />
    </View>
  );
}
