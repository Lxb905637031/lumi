import { View } from '@tarojs/components';
import { useRouter } from '@tarojs/taro';
import { PostDetail } from '../../features/community/components/PostDetail';
import '../index/index.scss';
export default function PostPage() {
  const router = useRouter();
  return (
    <View className="page">
      <PostDetail id={router.params.id ?? ''} />
    </View>
  );
}
