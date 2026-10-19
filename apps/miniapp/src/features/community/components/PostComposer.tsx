import { useEffect, useRef, useState } from 'react';
import { Image, Input, Text, Textarea, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { ensureLogin } from '../../auth/auth.api';
import { getMediaAsset, uploadImage } from '../../media/media.api';
import { createCommunityPost } from '../community.api';
import { getGeneration } from '../../generations/generations.api';
import { getSessionEpoch } from '../../../services/http-client';
import '../../feed/components/InspirationGrid.scss';

type Draft = { title: string; body: string; topic: string; assets: Array<{ id: string; preview: string }> };
const DRAFT_KEY = 'lumi.postDraft';

export function PostComposer({ source }: { source?: { jobId: string; outputId: string } }) {
  const [draft, setDraft] = useState<Draft>(
    () => (!source && Taro.getStorageSync<Draft>(DRAFT_KEY)) || { title: '', body: '', topic: '', assets: [] },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const [sourceReady, setSourceReady] = useState(!source);
  const mounted = useRef(true);
  const lock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const loadSource = async () => {
    if (!source || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    const epoch = getSessionEpoch();
    try {
      const job = await getGeneration(source.jobId);
      const result = job.outputs.find((output) => output.id === source.outputId && output.selectedAt);
      if (!result) throw new Error('结果未确认或已删除，请返回生成记录');
      const asset = await getMediaAsset(result.assetId);
      if (!mounted.current || epoch !== getSessionEpoch()) return;
      setDraft((previous) => ({
        ...previous,
        assets: [{ id: result.assetId, preview: asset.url ?? asset.previewData ?? '' }],
      }));
      setSourceReady(true);
    } catch (reason) {
      if (mounted.current && epoch === getSessionEpoch())
        setError(reason instanceof Error ? reason.message : '结果读取失败，可重试');
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  useEffect(() => {
    if (source) void loadSource();
  }, [source?.jobId, source?.outputId]);
  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (!source) Taro.setStorageSync(DRAFT_KEY, next);
  };
  const choose = async () => {
    if (busy || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await ensureLogin();
      const result = await Taro.chooseImage({
        count: 9 - draft.assets.length,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });
      const additions: Draft['assets'] = [];
      for (const path of result.tempFilePaths) {
        const asset = await uploadImage(path);
        additions.push({ id: asset.id, preview: path });
        update({ assets: [...draft.assets, ...additions] });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '选图或上传失败，可重试');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const submit = async () => {
    if (busy || lock.current || !sourceReady) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await ensureLogin();
      if (source) {
        const job = await getGeneration(source.jobId);
        if (
          !job.outputs.some(
            (output) => output.id === source.outputId && output.selectedAt && output.assetId === draft.assets[0]?.id,
          )
        )
          throw new Error('结果已变化，请返回生成记录重新确认');
      }
      await createCommunityPost({
        title: draft.title.trim(),
        body: draft.body.trim(),
        topic: draft.topic.trim() || undefined,
        imageAssetIds: draft.assets.map((asset) => asset.id),
        ...(source ? { isAiGenerated: true } : {}),
      });
      if (!source) Taro.removeStorageSync(DRAFT_KEY);
      setSubmitted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '发布失败，草稿已保留');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (submitted)
    return (
      <View>
        <Text>已提交审核，通过后公开展示。</Text>
        <AppButton onClick={() => void Taro.navigateBack()}>完成</AppButton>
      </View>
    );
  return (
    <View className="feed-composer">
      <Input
        className="feed-input"
        value={draft.title}
        onInput={(event) => update({ title: event.detail.value })}
        placeholder="标题（必填）"
        maxlength={120}
      />
      <Textarea
        className="feed-textarea"
        value={draft.body}
        onInput={(event) => update({ body: event.detail.value })}
        placeholder="分享你的穿搭想法（必填）"
        maxlength={5000}
      />
      <Input
        className="feed-input"
        value={draft.topic}
        onInput={(event) => update({ topic: event.detail.value })}
        placeholder="话题（可选）"
        maxlength={80}
      />
      <View>
        {draft.assets.map((asset) => (
          <Image
            key={asset.id}
            className="feed-upload-preview"
            src={asset.preview}
            mode="aspectFill"
            onClick={() => {
              if (!source) update({ assets: draft.assets.filter((item) => item.id !== asset.id) });
            }}
          />
        ))}
      </View>
      <Text className="feed-caption">
        1–9 张图片，点击已选图片可移除。发布内容会公开，身体参数不会公开；需审核通过才进入推荐。
      </Text>
      {error && <InlineFeedback message={error} tone="error" />}
      {source && (
        <InlineFeedback message="发布已确认的生成结果，自动标记 AI/开发生成内容；不会公开身体参数。云端保存不等于公开，帖子需另行审核。" />
      )}
      {source && !sourceReady && (
        <AppButton disabled={busy} variant="secondary" onClick={() => void loadSource()}>
          重新读取结果
        </AppButton>
      )}
      {!source && (
        <AppButton
          variant="secondary"
          disabled={busy || draft.assets.length >= 9}
          loading={busy}
          onClick={() => void choose()}
        >
          添加图片
        </AppButton>
      )}
      <AppButton
        loading={busy}
        disabled={busy || !sourceReady || !draft.title.trim() || !draft.body.trim() || !draft.assets.length}
        onClick={() => void submit()}
      >
        提交审核
      </AppButton>
    </View>
  );
}
