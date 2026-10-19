import { View } from '@tarojs/components';
import { useRouter } from '@tarojs/taro';
import { GenerationHistory } from '../../features/generations/components/GenerationHistory';
import '../index/index.scss';
export default function GenerationsPage() {
  const router = useRouter();
  return (
    <View className="page">
      <GenerationHistory selectedId={router.params.id} />
    </View>
  );
}
