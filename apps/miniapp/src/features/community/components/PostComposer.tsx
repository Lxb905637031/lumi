import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { MediaUploadStatus } from '../../media/components/MediaUploadStatus';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { usePostComposer } from '../usePostComposer';
import type { PostSource } from '../post-composer-workflow';
import { PostComposerFields } from './PostComposerFields';
import { PostImagePicker } from './PostImagePicker';
import '../../feed/components/InspirationGrid.scss';
import '../../profile/components/ProfilePanel.scss';

export function PostComposer({ source }: { source?: PostSource }) {
  const { state, workflow } = usePostComposer(source);
  const locked = state.busy || !!state.pending;
  if (state.post)
    return (
      <View>
        <Text>
          {state.post.moderationStatus === 'APPROVED'
            ? '原帖子已审核通过，未重复发布。'
            : state.post.moderationStatus === 'PENDING'
              ? '已提交审核，通过后公开展示。'
              : '原帖子已有审核结论，请到我的帖子查看。'}
        </Text>
        <AppButton block onClick={() => void Taro.redirectTo({ url: '/pages/posts/index?collection=mine' })}>
          查看我的帖子
        </AppButton>
        <AppButton block variant="secondary" onClick={() => workflow.newDraft()}>
          新建另一篇
        </AppButton>
      </View>
    );
  return (
    <View className="feed-composer">
      <View className="feature-page-heading">
        <Text className="feature-eyebrow">COMMUNITY</Text>
        <Text className="page-title">发布一套穿搭</Text>
        <Text className="page-description">公开发布前会经过审核，身体参数和私有资料不会公开。</Text>
      </View>
      {!state.ready && (
        <AppButton block loading={state.busy} onClick={() => void workflow.prepare()}>
          {source ? '读取已确认结果并编辑' : '登录并开始编辑'}
        </AppButton>
      )}
      {state.ready && (
        <>
          <PostComposerFields draft={state.draft} disabled={locked} onChange={(patch) => workflow.edit(patch)} />
          <PostImagePicker
            assets={state.draft.assets}
            disabled={locked}
            source={!!source}
            remaining={state.remainingUploads}
            onRemove={(id) => workflow.removeAsset(id)}
            onAdd={() => void workflow.addImages()}
          />
          <MediaUploadStatus progress={state.uploadProgress} />
          {state.pending && (
            <InlineFeedback message="发布结果尚未确认，内容和原请求标识已保留。继续原发布不会重复创建，请勿换账号或重建内容。" />
          )}
          <AppButton
            block
            loading={state.busy}
            disabled={
              state.busy ||
              (!state.pending &&
                (!state.draft.title.trim() ||
                  !state.draft.body.trim() ||
                  !state.draft.assets.length ||
                  state.remainingUploads > 0))
            }
            onClick={() => void workflow.submit()}
          >
            {state.pending ? '继续原发布' : '确认并提交审核'}
          </AppButton>
          <Text className="feed-caption">
            草稿仅在当前登录会话内保留；关闭小程序或切换账号不会恢复。旧版未绑定账号的草稿不自动导入。
          </Text>
        </>
      )}
      {state.error && <InlineFeedback message={state.error} tone="error" />}
      <AppButton
        block
        variant="secondary"
        disabled={state.busy}
        onClick={() => void Taro.navigateTo({ url: '/pages/posts/index?collection=mine' })}
      >
        查询我的帖子
      </AppButton>
    </View>
  );
}
