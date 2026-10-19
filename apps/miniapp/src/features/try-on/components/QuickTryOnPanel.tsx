import { Image, Text, View } from '@tarojs/components';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { useQuickTryOn } from '../useQuickTryOn';
import './QuickTryOnPanel.scss';

export function QuickTryOnPanel({ onGoProfile }: { onGoProfile: () => void }) {
  const { state, start, retry, cancel } = useQuickTryOn();
  const busy = state.kind === 'loading';
  const job = state.kind === 'idle' ? undefined : state.job;
  const output = job?.outputs[0];

  return (
    <View className="try-on-empty-state">
      <Text className="try-on-empty-title">开始你的第一次试穿</Text>
      <Text className="try-on-empty-copy">
        先添加人物照片和衣物图片，再生成一张私有试穿参考图。当前免费环境使用本地预览 provider。
      </Text>
      <AppButton variant="secondary" onClick={onGoProfile}>
        完善档案和衣橱
      </AppButton>
      <AppButton loading={busy} onClick={start} disabled={busy}>
        {busy ? '生成中' : '开始免费试穿'}
      </AppButton>
      {state.kind !== 'idle' && state.kind !== 'loading' && (
        <InlineFeedback message={state.message} tone={state.kind} />
      )}
      {state.kind === 'loading' && (
        <>
          <InlineFeedback message={state.message} />
          {job && (
            <AppButton variant="secondary" onClick={cancel}>
              取消任务
            </AppButton>
          )}
        </>
      )}
      {state.kind === 'error' && job?.status !== 'CANCELLED' && (
        <AppButton variant="secondary" onClick={retry}>
          重试同一任务
        </AppButton>
      )}
      {output?.previewData && (
        <View className="try-on-result">
          <Text className="try-on-result-title">生成结果</Text>
          <Image className="try-on-result-image" src={output.previewData} mode="aspectFit" />
          <Text className="try-on-result-meta">结果已私有保存，可在生成记录中继续使用。</Text>
        </View>
      )}
    </View>
  );
}
