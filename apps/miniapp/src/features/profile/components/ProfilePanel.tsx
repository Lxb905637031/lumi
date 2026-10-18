import { Text, View } from '@tarojs/components';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import './ProfilePanel.scss';

type ProfilePanelProps = {
  onStartTryOn: () => void;
};

export function ProfilePanel({ onStartTryOn }: ProfilePanelProps) {
  return (
    <View className="profile-empty-state">
      <Text className="profile-empty-title">登录后管理你的资料</Text>
      <Text className="profile-empty-copy">你的身材档案、衣物和生成结果都会保存在这里。</Text>
      <AppButton onClick={onStartTryOn}>开始使用</AppButton>
    </View>
  );
}
