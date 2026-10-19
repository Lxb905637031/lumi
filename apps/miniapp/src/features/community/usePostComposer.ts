import { useEffect, useMemo, useSyncExternalStore } from 'react';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import { ensureLogin } from '../auth/auth.api';
import { getMediaAsset, uploadImage } from '../media/media.api';
import { getGeneration } from '../generations/generations.api';
import { getSessionEpoch } from '../../services/http-client';
import { createCommunityPost } from './community.api';
import { PostComposerWorkflow, type PostSource } from './post-composer-workflow';

let cacheEpoch = getSessionEpoch();
const drafts = new Map<string, PostComposerWorkflow>();

function workflowFor(source?: PostSource) {
  if (cacheEpoch !== getSessionEpoch()) {
    drafts.clear();
    cacheEpoch = getSessionEpoch();
  }
  const key = source ? `${source.jobId}:${source.outputId}` : 'images';
  let workflow = drafts.get(key);
  if (!workflow) {
    workflow = new PostComposerWorkflow(
      {
        login: ensureLogin,
        sessionEpoch: getSessionEpoch,
        key: () => `post-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        choose: async (count) =>
          (await Taro.chooseImage({ count, sizeType: ['compressed'], sourceType: ['album', 'camera'] })).tempFilePaths,
        upload: async (path) => ({ id: (await uploadImage(path)).id, preview: path }),
        source: async (input) => {
          const job = await getGeneration(input.jobId);
          const output = job.outputs.find((result) => result.id === input.outputId && result.selectedAt);
          if (!output || job.status !== 'SUCCEEDED') throw new Error('结果未确认或已删除，请返回生成记录');
          const asset = await getMediaAsset(output.assetId);
          if (asset.status !== 'READY') throw new Error('生成图片已不可用');
          return { id: asset.id, preview: asset.url ?? asset.previewData ?? '' };
        },
        confirm: async () =>
          (
            await Taro.showModal({
              title: '确认提交社区审核',
              content: '标题、正文和所选图片将在审核通过后公开。身体参数不会公开。请确认图片版权及肖像授权。',
              confirmText: '提交审核',
            })
          ).confirm,
        create: createCommunityPost,
      },
      source,
    );
    drafts.set(key, workflow);
  }
  return workflow;
}

export function usePostComposer(source?: PostSource) {
  const workflow = useMemo(() => workflowFor(source), [source?.jobId, source?.outputId]);
  const state = useSyncExternalStore(workflow.subscribe, workflow.snapshot, workflow.snapshot);
  useEffect(() => {
    workflow.resume();
    return () => workflow.leave();
  }, [workflow]);
  useDidShow(() => workflow.resume());
  useDidHide(() => workflow.leave());
  return { state, workflow };
}
