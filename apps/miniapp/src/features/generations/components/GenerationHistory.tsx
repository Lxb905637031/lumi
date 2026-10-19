import { useEffect, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import type { GenerationJob } from '@lumi/contracts';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { ResourceStatus } from '../../../components/ui/ResourceStatus/ResourceStatus';
import { useCursorList } from '../../../hooks/useCursorList';
import { cancelGeneration, getGeneration, listGenerations, retryGeneration } from '../generations.api';

const statusLabels: Record<GenerationJob['status'], string> = {
  QUEUED: '排队中',
  RUNNING: '生成中',
  SUCCEEDED: '已完成',
  FAILED: '失败',
  DEAD_LETTER: '可重试',
  CANCELLED: '已取消',
};

export function GenerationHistory({ selectedId }: { selectedId?: string }) {
  const list = useCursorList(listGenerations);
  const [selected, setSelected] = useState<GenerationJob>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const read = async (id: string) => {
    try {
      setSelected(await getGeneration(id));
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '任务读取失败');
    }
  };
  useEffect(() => {
    if (selectedId) void read(selectedId);
  }, [selectedId]);
  const act = async (job: GenerationJob, action: 'cancel' | 'retry') => {
    if (busy) return;
    setBusy(true);
    try {
      setSelected(action === 'cancel' ? await cancelGeneration(job.id) : await retryGeneration(job.id));
      await list.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View>
      <Text className="profile-section-title">生成记录</Text>
      <ResourceStatus
        loading={list.loading}
        error={list.error}
        empty={!list.items.length}
        onRetry={() => void list.reload()}
      />
      {error && <InlineFeedback message={error} tone="error" />}
      {list.items.map((job) => (
        <View className="profile-record" key={job.id}>
          <View>
            <Text>{statusLabels[job.status]}</Text>
            <Text className="profile-muted">{new Date(job.createdAt).toLocaleString('zh-CN')}</Text>
          </View>
          <AppButton variant="secondary" onClick={() => void read(job.id)}>
            查看任务
          </AppButton>
        </View>
      ))}
      {list.hasMore && (
        <AppButton variant="secondary" onClick={() => void list.loadMore()}>
          更多记录
        </AppButton>
      )}
      {selected && (
        <View className="profile-section">
          <Text>{statusLabels[selected.status]}</Text>
          <Text className="profile-muted">提供方：{selected.provider}，本地预览不是实际 AI 试穿。</Text>
          {selected.outputs.map(
            (output) =>
              output.previewData && (
                <Image className="try-on-result-image" key={output.id} src={output.previewData} mode="aspectFit" />
              ),
          )}
          {['QUEUED', 'RUNNING'].includes(selected.status) && (
            <AppButton disabled={busy} variant="secondary" onClick={() => void act(selected, 'cancel')}>
              取消任务
            </AppButton>
          )}
          {['FAILED', 'DEAD_LETTER'].includes(selected.status) && (
            <AppButton loading={busy} onClick={() => void act(selected, 'retry')}>
              重试原任务
            </AppButton>
          )}
          <AppButton variant="secondary" onClick={() => void read(selected.id)}>
            刷新状态
          </AppButton>
        </View>
      )}
    </View>
  );
}
