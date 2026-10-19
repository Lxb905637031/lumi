import { View } from '@tarojs/components';
import { BodyProfileManager } from '../../features/body-profiles/components/BodyProfileManager';
import '../index/index.scss';
export default function ProfilesPage() {
  return (
    <View className="page">
      <BodyProfileManager />
    </View>
  );
}
