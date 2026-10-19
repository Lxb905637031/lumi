import { useState } from 'react';
import { Image, Input, Text, Textarea, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { ensureLogin } from '../../auth/auth.api';
import { uploadImage } from '../../media/media.api';
import { createCommunityPost } from '../community.api';
import '../../feed/components/InspirationGrid.scss';

type Draft = { title: string; body: string; topic: string; assets: Array<{ id: string; preview: string }> };
const DRAFT_KEY = 'lumi.postDraft';

export function PostComposer() {
  const [draft, setDraft] = useState<Draft>(
    () => Taro.getStorageSync<Draft>(DRAFT_KEY) || { title: '', body: '', topic: '', assets: [] },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    Taro.setStorageSync(DRAFT_KEY, next);
  };
  const choose = async () => {
    if (busy) return;
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
      setBusy(false);
    }
  };
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await ensureLogin();
      await createCommunityPost({
        title: draft.title.trim(),
        body: draft.body.trim(),
        topic: draft.topic.trim() || undefined,
        imageAssetIds: draft.assets.map((asset) => asset.id),
      });
      Taro.removeStorageSync(DRAFT_KEY);
      setSubmitted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '发布失败，草稿已保留');
    } finally {
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
            onClick={() => update({ assets: draft.assets.filter((item) => item.id !== asset.id) })}
          />
        ))}
      </View>
      <Text className="feed-caption">
        1–9 张图片，点击已选图片可移除。发布内容会公开，身体参数不会公开；需审核通过才进入推荐。
      </Text>
      {error && <InlineFeedback message={error} tone="error" />}
      <AppButton
        variant="secondary"
        disabled={busy || draft.assets.length >= 9}
        loading={busy}
        onClick={() => void choose()}
      >
        添加图片
      </AppButton>
      <AppButton
        loading={busy}
        disabled={busy || !draft.title.trim() || !draft.body.trim() || !draft.assets.length}
        onClick={() => void submit()}
      >
        提交审核
      </AppButton>
    </View>
  );
}
