import { Text, View } from '@tarojs/components';
import { AppButton } from '../AppButton/AppButton';
import { InlineFeedback } from '../InlineFeedback/InlineFeedback';
import './ResourceStatus.scss';

export function ResourceStatus({
  loading,
  error,
  empty,
  onRetry,
  emptyTitle = '这里还没有内容',
  emptyDescription = '有新的内容时，会显示在这里。',
}: {
  loading: boolean;
  error?: string;
  empty?: boolean;
  onRetry: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (error)
    return (
      <View className="resource-state resource-state--error">
        <Text className="resource-state-title">暂时无法读取</Text>
        <InlineFeedback message={error} tone="error" />
        <AppButton block variant="secondary" onClick={onRetry}>
          重新读取
        </AppButton>
      </View>
    );
  if (loading)
    return (
      <View className="resource-state resource-state--loading" aria-busy="true">
        <View className="resource-loading-lines">
          <View />
          <View />
          <View />
        </View>
        <Text className="resource-state-copy">正在读取…</Text>
      </View>
    );
  if (empty)
    return (
      <View className="resource-state resource-state--empty">
        <Text className="resource-state-title">{emptyTitle}</Text>
        <Text className="resource-state-copy">{emptyDescription}</Text>
      </View>
    );
  return null;
}
