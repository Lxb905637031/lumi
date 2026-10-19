import { View } from '@tarojs/components';
import { useRouter } from '@tarojs/taro';
import { PostCollection } from '../../features/community/components/PostCollection';
import '../index/index.scss';
export default function PostsPage() {
  const router = useRouter();
  return (
    <View className="page">
      <PostCollection collection={router.params.collection === 'bookmarks' ? 'bookmarks' : 'mine'} />
    </View>
  );
}
