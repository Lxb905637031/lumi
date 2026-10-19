import { Text, View } from '@tarojs/components';
import { AppButton } from '../AppButton/AppButton';
import { InlineFeedback } from '../InlineFeedback/InlineFeedback';

export function ResourceStatus({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading: boolean;
  error?: string;
  empty?: boolean;
  onRetry: () => void;
}) {
  if (error)
    return (
      <View>
        <InlineFeedback message={error} tone="error" />
        <AppButton variant="secondary" onClick={onRetry}>
          重试
        </AppButton>
      </View>
    );
  if (loading) return <Text>正在加载…</Text>;
  if (empty) return <Text>暂无记录</Text>;
  return null;
}
