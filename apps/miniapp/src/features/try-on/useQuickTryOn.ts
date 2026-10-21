import { useEffect, useState, useSyncExternalStore } from 'react';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import { getSessionEpoch } from '../../services/http-client';
import { ensureLogin } from '../auth/auth.api';
import { listBodyProfilePage, listBodyProfileVersions } from '../body-profiles/body-profiles.api';
import { cancelGeneration, createGeneration, getGeneration, retryGeneration } from '../generations/generations.api';
import { getQuota } from '../quota/quota.api';
import { listClothingPage } from '../wardrobe/wardrobe.api';
import { isActiveJob, TryOnWorkflow } from './try-on-workflow';

// Memory only, shared across custom tab remounts; never persist photos/measurements to disk.
const workflow = new TryOnWorkflow({
  login: ensureLogin,
  sessionEpoch: getSessionEpoch,
  profiles: listBodyProfilePage,
  profileVersions: listBodyProfileVersions,
  clothing: listClothingPage,
  quota: getQuota,
  create: createGeneration,
  read: getGeneration,
  retry: retryGeneration,
  cancel: cancelGeneration,
  confirm: async (content) =>
    (await Taro.showModal({ title: '确认本次试穿', content, confirmText: '确认生成' })).confirm,
  key: () => `try-on-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
});

export function useQuickTryOn() {
  const state = useSyncExternalStore(workflow.subscribe, workflow.snapshot);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    workflow.resetForSession();
    if (isActiveJob(workflow.snapshot().job)) void workflow.refreshJob();
    return () => workflow.leave();
  }, []);
  useDidHide(() => {
    setVisible(false);
    workflow.leave();
  });
  useDidShow(() => {
    setVisible(true);
    workflow.resetForSession();
    void workflow.refreshJob();
  });
  useEffect(() => {
    if (!visible || state.busy || state.error || !isActiveJob(state.job)) return;
    const timer = setTimeout(() => void workflow.refreshJob(), 1000);
    return () => clearTimeout(timer);
  }, [visible, state.busy, state.error, state.job]);
  return { state, workflow };
}
