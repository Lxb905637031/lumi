import { useRef, useState } from 'react';
import Taro from '@tarojs/taro';
import type { GenerationJob } from '@lumi/contracts';
import { ensureLogin } from '../auth/auth.api';
import { listBodyProfiles } from '../body-profiles/body-profiles.api';
import { cancelGeneration, createGeneration, getGeneration, retryGeneration } from '../generations/generations.api';
import { listClothingItems } from '../wardrobe/wardrobe.api';

export type TryOnState =
  | { kind: 'idle' }
  | { kind: 'loading'; message: string; job?: GenerationJob }
  | { kind: 'success'; message: string; job: GenerationJob }
  | { kind: 'error'; message: string; job?: GenerationJob };

function createIdempotencyKey(): string {
  return `try-on-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useQuickTryOn() {
  const [state, setState] = useState<TryOnState>({ kind: 'idle' });
  const busyRef = useRef(false);
  const idempotencyKeyRef = useRef<string | undefined>(undefined);

  const watch = async (initialJob: GenerationJob): Promise<GenerationJob> => {
    let latest = initialJob;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (latest.status !== 'QUEUED' && latest.status !== 'RUNNING') return latest;
      setState({
        kind: 'loading',
        message: attempt === 0 ? '任务已创建，正在生成…' : `生成中（${attempt}/20）…`,
        job: latest,
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      latest = await getGeneration(initialJob.id);
    }
    return latest;
  };

  const finish = (job: GenerationJob) => {
    if (job.status === 'SUCCEEDED') {
      idempotencyKeyRef.current = undefined;
      setState({ kind: 'success', message: '试穿完成，结果已保存到生成记录。', job });
      return;
    }
    if (job.status === 'CANCELLED') {
      idempotencyKeyRef.current = undefined;
      setState({ kind: 'error', message: '任务已取消，可以重新发起试穿。', job });
      return;
    }
    if (job.status === 'FAILED' || job.status === 'DEAD_LETTER') {
      setState({ kind: 'error', message: '生成暂时失败，可以重试同一任务。', job });
      return;
    }
    setState({ kind: 'error', message: '任务仍在处理中，请稍后继续查询。', job });
  };

  const run = async (jobPromise: Promise<GenerationJob>) => {
    try {
      const job = await jobPromise;
      const latest = await watch(job);
      finish(latest);
    } catch (error) {
      const message = error instanceof Error ? error.message : '暂时无法完成试穿，请稍后重试';
      setState((previous) => ({ kind: 'error', message, job: previous.kind === 'loading' ? previous.job : undefined }));
      Taro.showToast({ title: '试穿失败', icon: 'none' });
    } finally {
      busyRef.current = false;
    }
  };

  const start = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setState({ kind: 'loading', message: '正在连接 Lumi…' });
    try {
      await ensureLogin();
      const profiles = await listBodyProfiles();
      const profileVersionId = profiles[0]?.versions[0]?.id;
      if (!profileVersionId) throw new Error('请先在“我的”中创建身材档案并添加至少一张人物照片');
      const clothingItems = await listClothingItems();
      const clothing = clothingItems[0];
      if (!clothing) throw new Error('请先在“我的”中添加一件衣橱单品');
      idempotencyKeyRef.current ??= createIdempotencyKey();
      await run(
        createGeneration({
          profileVersionId,
          clothingAssetId: clothing.id,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      );
    } catch (error) {
      busyRef.current = false;
      const message = error instanceof Error ? error.message : '暂时无法完成试穿，请稍后重试';
      setState({ kind: 'error', message });
      Taro.showToast({ title: '试穿失败', icon: 'none' });
    }
  };

  const retry = async () => {
    const job = state.kind === 'idle' ? undefined : state.job;
    if (busyRef.current || !job) return;
    busyRef.current = true;
    setState({ kind: 'loading', message: '正在重新排队…', job });
    await run(retryGeneration(job.id));
  };

  const cancel = async () => {
    const job = state.kind === 'idle' ? undefined : state.job;
    if (busyRef.current || !job) return;
    busyRef.current = true;
    try {
      const cancelledJob = await cancelGeneration(job.id);
      finish(cancelledJob);
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : '取消失败，请稍后重试', job });
    } finally {
      busyRef.current = false;
    }
  };

  return { state, start, retry, cancel };
}
