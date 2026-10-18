import { Text, View } from '@tarojs/components';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { useQuickTryOn } from '../useQuickTryOn';
import './QuickTryOnPanel.scss';

export function QuickTryOnPanel() {
  const { state, start } = useQuickTryOn();
  const busy = state.kind === 'loading';

  return (
    <View className="try-on-empty-state">
      <Text className="try-on-empty-title">开始你的第一次试穿</Text>
      <Text className="try-on-empty-copy">联调流程会使用默认档案和衣橱首项创建试穿任务。</Text>
      <AppButton loading={busy} onClick={start}>
        {busy ? '生成中' : '开始免费试穿'}
      </AppButton>
      {state.kind !== 'idle' && state.kind !== 'loading' && (
        <InlineFeedback message={state.message} tone={state.kind} />
      )}
      {state.kind === 'loading' && <InlineFeedback message={state.message} />}
    </View>
  );
}
