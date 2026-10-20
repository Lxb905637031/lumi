import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { GenerationJob, GenerationOutput } from '@lumi/contracts';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import type { ResultAction } from '../generations.api';
import { PrivateMediaImage } from '../../media/components/PrivateMediaImage';

type Props = {
  job: GenerationJob;
  output: GenerationOutput;
  busy: boolean;
  onAction: (output: GenerationOutput, action: ResultAction) => void;
};

export function GenerationResultActions({ job, output, busy, onAction }: Props) {
  const localPreview = job.provider === 'local-svg';
  return (
    <View className="generation-result-card surface">
      <PrivateMediaImage assetId={output.assetId} />
      <Text className="generation-result-title">{output.selectedAt ? '已确认结果' : '待确认结果'}</Text>
      <Text className="profile-muted">{output.savedAt ? '已云端保存（非手机相册）' : '默认私有，未云端保存'}</Text>
      {localPreview && <InlineFeedback message="本地 SVG 开发预览，不是真实 AI，不提供相册下载或好友分享。" />}
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
        <AppButton block disabled={busy} variant="secondary" onClick={() => onAction(output, 'delete')}>
          删除此结果
        </AppButton>
      </View>
    </View>
  );
}
