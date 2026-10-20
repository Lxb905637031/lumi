import { View } from '@tarojs/components';
import { AccountPrivacyPanel } from '../../features/account-privacy/components/AccountPrivacyPanel';
import '../index/index.scss';

export default function PrivacyPage() {
  return (
    <View className="page">
      <AccountPrivacyPanel />
    </View>
  );
}
