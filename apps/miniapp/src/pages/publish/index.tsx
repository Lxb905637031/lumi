import { View } from '@tarojs/components';
import { PostComposer } from '../../features/community/components/PostComposer';
import '../index/index.scss';
export default function PublishPage() {
  return (
    <View className="page">
      <PostComposer />
    </View>
  );
}
