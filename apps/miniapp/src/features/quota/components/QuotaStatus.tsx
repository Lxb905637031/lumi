import { Text, View } from '@tarojs/components';
import type { QuotaSummary } from '@lumi/contracts';
import './QuotaStatus.scss';

export function QuotaStatus({ quota }: { quota?: QuotaSummary }) {
  if (!quota) return <Text className="profile-hint">额度尚未读取；以服务端余额为准。</Text>;
  return (
    <View className="quota-summary">
      <Text className="profile-muted">
        免费体验剩余 {quota.available} 次 · 预留 {quota.reserved} 次 · 已使用 {quota.consumed} 次
      </Text>
      <Text className="profile-hint">
        每次预留 {quota.costPerGeneration} 次，成功才消耗；失败或取消释放。资料保存不消耗额度。
      </Text>
    </View>
  );
}
