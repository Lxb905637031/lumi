import { View } from '@tarojs/components';
import { useRouter } from '@tarojs/taro';
import { FollowList } from '../../features/community/components/FollowList';
import '../index/index.scss';

export default function FollowsPage() {
  const router = useRouter();
  return (
    <View className="page">
      <FollowList initialMode={router.params.mode === 'followers' ? 'followers' : 'following'} />
    </View>
  );
}
