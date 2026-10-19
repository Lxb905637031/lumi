import { View } from '@tarojs/components';
import { useRouter } from '@tarojs/taro';
import { PostComposer } from '../../features/community/components/PostComposer';
import '../index/index.scss';
export default function PublishPage() {
  const { params } = useRouter();
  return (
    <View className="page">
      <PostComposer
        source={params.jobId && params.outputId ? { jobId: params.jobId, outputId: params.outputId } : undefined}
      />
    </View>
  );
}
