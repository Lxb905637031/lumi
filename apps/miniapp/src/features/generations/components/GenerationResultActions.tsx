import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import type { GenerationJob, GenerationOutput } from '@lumi/contracts';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import type { ResultAction } from '../generations.api';
import { PrivateMediaImage } from '../../media/components/PrivateMediaImage';
import { createGenerationShare } from '../generation-sharing.api';

type Props = {
  job: GenerationJob;
  output: GenerationOutput;
  busy: boolean;
  onAction: (output: GenerationOutput, action: ResultAction) => void;
};

export function GenerationResultActions({ job, output, busy, onAction }: Props) {
  const localPreview = job.provider === 'local-svg';
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string>();
  const share = async () => {
    if (shareBusy || busy || !output.selectedAt) return;
    setShareBusy(true);
    setShareError(undefined);
    try {
      const link = await createGenerationShare(job.id, output.id);
      await Taro.navigateTo({ url: `/pages/generation-share/index?token=${encodeURIComponent(link.token)}` });
    } catch (reason) {
      setShareError(reason instanceof Error ? reason.message : '分享链接生成失败，请重试');
    } finally {
      setShareBusy(false);
    }
  };
  return (
    <View className="generation-result-card surface">
      <PrivateMediaImage assetId={output.assetId} />
      <Text className="generation-result-title">{output.selectedAt ? '已确认结果' : '待确认结果'}</Text>
      <Text className="profile-muted">{output.savedAt ? '已云端保存（非手机相册）' : '默认私有，未云端保存'}</Text>
      {localPreview && <InlineFeedback message="本地 SVG 开发预览，不是真实 AI；分享页仅用于联调链路。" />}
      <View className="generation-result-actions">
        <AppButton
          block
          disabled={busy || !!output.selectedAt}
          variant="secondary"
          onClick={() => onAction(output, 'select')}
        >
          {output.selectedAt ? '已确认' : '确认此结果'}
        </AppButton>
        <AppButton
          block
          disabled={busy || (!output.savedAt && !output.selectedAt)}
          variant="secondary"
          onClick={() => onAction(output, output.savedAt ? 'unsave' : 'save')}
        >
          {output.savedAt ? '取消云端保存' : '云端保存'}
        </AppButton>
        <AppButton
          block
          disabled={busy || !output.selectedAt}
          onClick={() =>
            void Taro.navigateTo({
              url: `/pages/publish/index?jobId=${encodeURIComponent(job.id)}&outputId=${encodeURIComponent(output.id)}`,
            })
          }
        >
          编辑并提交社区审核
        </AppButton>
        <AppButton
          block
          variant="secondary"
          disabled={busy || shareBusy || !output.selectedAt}
          loading={shareBusy}
          onClick={() => void share()}
        >
          分享结果
        </AppButton>
        <AppButton block disabled={busy} variant="secondary" onClick={() => onAction(output, 'delete')}>
          删除此结果
        </AppButton>
      </View>
      {shareError && <InlineFeedback message={shareError} tone="error" />}
    </View>
  );
}
