import { View } from '@tarojs/components';
import { FollowList } from '../../features/community/components/FollowList';
import '../index/index.scss';

export default function FollowsPage() {
  return (
    <View className="page">
      <FollowList />
    </View>
  );
}
