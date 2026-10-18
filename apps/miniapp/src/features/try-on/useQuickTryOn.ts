import { useRef, useState } from 'react';
import Taro from '@tarojs/taro';
import type { GenerationJobStatus } from '@lumi/contracts';
import { login } from '../auth/auth.api';
import { listBodyProfiles, createBodyProfile } from '../body-profiles/body-profiles.api';
import { createGeneration, getGeneration } from '../generations/generations.api';
import { createClothingItem, listClothingItems } from '../wardrobe/wardrobe.api';

type TryOnState =
  | { kind: 'idle' }
  | { kind: 'loading'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

function createIdempotencyKey(): string {
  return `try-on-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useQuickTryOn() {
  const [state, setState] = useState<TryOnState>({ kind: 'idle' });
  const busyRef = useRef(false);
  const idempotencyKeyRef = useRef<string | undefined>(undefined);

  const start = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setState({ kind: 'loading', message: '正在连接 Lumi…' });
    try {
      await login();
      const profiles = await listBodyProfiles();
      const profile =
        profiles[0] ??
        (await createBodyProfile({
          name: '我的默认档案',
          heightCm: 165,
          weightKg: 52,
        }));
      let profileVersionId = profiles[0]?.versions[0]?.id;
      if (!profileVersionId && !profiles[0]) profileVersionId = profile.id;
      if (!profileVersionId) throw new Error('身材档案缺少有效版本，请重新创建档案');
      const clothingItems = await listClothingItems();
      const clothing = clothingItems[0] ?? (await createClothingItem({ name: '日常上装', category: 'TOP' }));
      idempotencyKeyRef.current ??= createIdempotencyKey();
      const job = await createGeneration({
        profileVersionId,
        clothingAssetId: clothing.id,
        idempotencyKey: idempotencyKeyRef.current,
      });

      let latest: { id: string; status: GenerationJobStatus } = job;
      for (let attempt = 0; attempt < 6 && (latest.status === 'QUEUED' || latest.status === 'RUNNING'); attempt += 1) {
        setState({ kind: 'loading', message: attempt === 0 ? '任务已创建，正在生成…' : `生成中（${attempt}/5）…` });
        await new Promise((resolve) => setTimeout(resolve, 500));
        latest = await getGeneration(job.id);
      }
      if (latest.status === 'SUCCEEDED') {
        idempotencyKeyRef.current = undefined;
        setState({ kind: 'success', message: '试穿完成，结果已保存到生成记录。' });
      } else if (latest.status === 'FAILED' || latest.status === 'CANCELLED') {
        idempotencyKeyRef.current = undefined;
        setState({ kind: 'error', message: `任务${latest.status === 'FAILED' ? '失败' : '已取消'}，请重新发起。` });
      } else {
        setState({ kind: 'error', message: '任务仍在处理中。点击重试会继续查询同一任务。' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '暂时无法完成试穿，请稍后重试';
      setState({ kind: 'error', message });
      Taro.showToast({ title: '试穿失败', icon: 'none' });
    } finally {
      busyRef.current = false;
    }
  };

  return { state, start };
}
