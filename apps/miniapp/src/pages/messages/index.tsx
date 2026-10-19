import { View } from '@tarojs/components';
import { NotificationCenter } from '../../features/notifications/components/NotificationCenter';
import '../index/index.scss';
export default function MessagesPage() {
  return (
    <View className="page">
      <NotificationCenter />
    </View>
  );
}
