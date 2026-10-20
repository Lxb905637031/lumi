import { Image, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { QuotaStatus } from '../../quota/components/QuotaStatus';
import { useQuickTryOn } from '../useQuickTryOn';
import { isActiveJob } from '../try-on-workflow';
import { TryOnInputPicker } from './TryOnInputPicker';
import '../../profile/components/ProfilePanel.scss';
import './QuickTryOnPanel.scss';

export function QuickTryOnPanel({ onGoProfile }: { onGoProfile: () => void }) {
  const { state, workflow } = useQuickTryOn();
  const active = isActiveJob(state.job);
  const output = state.job?.outputs[0];
  const exhausted = !!state.quota && state.quota.available < state.quota.costPerGeneration;
  return (
    <View className="try-on-empty-state">
      <Text className="try-on-empty-title">这一次，试着换个搭配</Text>
      <Text className="try-on-empty-copy">
        先明确选择人物版本和单件衣物，再确认生成。当前仅为本地预览，不是真实 AI，不保证尺码合身。
      </Text>
      {!state.pendingInput && !active && (
        <AppButton block variant="secondary" loading={state.busy} onClick={() => void workflow.prepare()}>
          {state.loaded ? '刷新资料和额度' : '选择试穿资料'}
        </AppButton>
      )}
      {state.loaded && (
        <>
          <TryOnInputPicker state={state} workflow={workflow} />
          <QuotaStatus quota={state.quota} />
          {!active && (
            <AppButton
              block
              loading={state.busy}
              disabled={!state.profileVersionId || !state.clothingId || (exhausted && !state.pendingInput)}
              onClick={() => void workflow.start()}
            >
              {state.pendingInput ? '继续提交原任务' : '下一步 · 确认试穿'}
            </AppButton>
          )}
        </>
      )}
      {!active && !state.pendingInput && (
        <View className="try-on-manage">
          <AppButton compact variant="secondary" onClick={onGoProfile}>
            管理人物档案
          </AppButton>
          <AppButton compact variant="secondary" onClick={() => void Taro.switchTab({ url: '/pages/wardrobe/index' })}>
            管理衣橱
          </AppButton>
        </View>
      )}
      {exhausted && <InlineFeedback message="免费额度不足；仍可查询、取消已有任务，不开放付费购买。" />}
      {state.error && <InlineFeedback message={state.error} tone="error" />}
      {state.error && state.job && !active && (
        <AppButton block variant="secondary" disabled={state.busy} onClick={() => void workflow.refreshJob()}>
          重新查询原任务
        </AppButton>
      )}
      {state.pendingInput && !state.job && (
        <InlineFeedback message="提交结果尚未确认。输入和请求标识已保留，继续原请求不会重复新建；切勿切换账号后重建。" />
      )}
      {active && (
        <>
          <InlineFeedback
            message={state.job?.status === 'QUEUED' ? '已预留额度，任务排队中。' : '正在生成，成功后结算额度。'}
          />
          <AppButton block variant="secondary" disabled={state.busy} onClick={() => void workflow.refreshJob()}>
            查询任务状态
          </AppButton>
          <AppButton block variant="secondary" disabled={state.busy} onClick={() => void workflow.cancel()}>
            取消任务并释放预留
          </AppButton>
        </>
      )}
      {state.job && ['FAILED', 'DEAD_LETTER'].includes(state.job.status) && (
        <AppButton block variant="secondary" disabled={state.busy || exhausted} onClick={() => void workflow.retry()}>
          使用原快照重试
        </AppButton>
      )}
      {state.job?.status === 'CANCELLED' && <InlineFeedback message="任务已取消，预留额度已释放。" />}
      {output?.previewData && (
        <View className="try-on-result">
          <Text className="try-on-result-title">本地开发预览</Text>
          <Image className="try-on-result-image" src={output.previewData} mode="aspectFit" />
          <Text className="try-on-result-meta">
            输出默认私有。在生成记录中确认、云端保存、删除或提交社区审核；真实 AI、相册下载和好友分享尚未验收。
          </Text>
          <AppButton
            block
            variant="secondary"
            onClick={() =>
              void Taro.navigateTo({ url: `/pages/generations/index?id=${encodeURIComponent(state.job!.id)}` })
            }
          >
            管理此结果
          </AppButton>
        </View>
      )}
    </View>
  );
}
