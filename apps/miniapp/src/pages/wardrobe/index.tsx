import { View } from '@tarojs/components';
import { WardrobeManager } from '../../features/wardrobe/components/WardrobeManager';
import '../index/index.scss';
export default function WardrobePage() {
  return (
    <View className="page">
      <WardrobeManager />
    </View>
  );
}
