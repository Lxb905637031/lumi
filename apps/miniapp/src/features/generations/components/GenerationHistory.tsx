import { useEffect, useRef, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import type { GenerationJob, GenerationOutput } from '@lumi/contracts';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { ResourceStatus } from '../../../components/ui/ResourceStatus/ResourceStatus';
import { useCursorList } from '../../../hooks/useCursorList';
import {
  cancelGeneration,
  getGeneration,
  listGenerations,
  retryGeneration,
  updateGenerationResult,
  type ResultAction,
} from '../generations.api';
import { getSessionEpoch } from '../../../services/http-client';
import { GenerationResultActions } from './GenerationResultActions';

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
  const operation = useRef(0);
  const locked = useRef(false);
  const visible = useRef(true);
  const epoch = useRef(getSessionEpoch());
  const leave = () => {
    visible.current = false;
    operation.current += 1;
    locked.current = false;
  };
  useDidHide(leave);
  useDidShow(() => {
    visible.current = true;
    setBusy(false);
    if (epoch.current !== getSessionEpoch()) {
      epoch.current = getSessionEpoch();
      setSelected(undefined);
      setError(undefined);
    }
  });
  useEffect(() => leave, []);
  const run = async (action: () => Promise<GenerationJob>, confirmDelete = false) => {
    if (locked.current || !visible.current) return;
    locked.current = true;
    const version = ++operation.current;
    const currentEpoch = getSessionEpoch();
    const valid = () => visible.current && version === operation.current && currentEpoch === getSessionEpoch();
    setBusy(true);
    setError(undefined);
    try {
      if (confirmDelete) {
        const answer = await Taro.showModal({
          title: '删除私有结果',
          content: '删除后无法恢复，不返还已成功消耗的额度。被帖子引用时请先删除帖子。',
          confirmText: '删除结果',
        });
        if (!answer.confirm || !valid()) return;
      }
      const result = await action();
      if (valid()) setSelected(result);
    } catch (reason) {
      if (valid()) setError(reason instanceof Error ? reason.message : '操作结果未知，请刷新原任务核对');
    } finally {
      if (valid()) {
        locked.current = false;
        setBusy(false);
      }
    }
  };
  const read = async (id: string) => {
    await run(() => getGeneration(id));
  };
  useEffect(() => {
    if (selectedId) void read(selectedId);
  }, [selectedId]);
  const act = async (job: GenerationJob, action: 'cancel' | 'retry') => {
    await run(() => (action === 'cancel' ? cancelGeneration(job.id) : retryGeneration(job.id)));
    if (visible.current) await list.reload();
  };
  const resultAction = (output: GenerationOutput, action: ResultAction) => {
    if (selected) void run(() => updateGenerationResult(selected.id, output.id, action), action === 'delete');
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
          <AppButton disabled={busy} variant="secondary" onClick={() => void read(job.id)}>
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
          {selected.status === 'SUCCEEDED' && !selected.outputs.length && (
            <InlineFeedback message="无可用结果，已删除的结果不会重新出现。" />
          )}
          {selected.outputs.map((output) => (
            <GenerationResultActions
              key={output.id}
              job={selected}
              output={output}
              busy={busy}
              onAction={resultAction}
            />
          ))}
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
          <AppButton disabled={busy} variant="secondary" onClick={() => void read(selected.id)}>
            刷新状态
          </AppButton>
        </View>
      )}
    </View>
  );
}
