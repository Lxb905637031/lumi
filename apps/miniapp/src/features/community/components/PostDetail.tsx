import { useState } from 'react';
import { Image, Input, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { ResourceStatus } from '../../../components/ui/ResourceStatus/ResourceStatus';
import { usePostDetail } from '../usePostDetail';
import '../../feed/components/InspirationGrid.scss';
import { FollowButton } from './FollowButton';
import '../../profile/components/ProfilePanel.scss';

export function PostDetail({ id }: { id: string }) {
  const detail = usePostDetail(id);
  const [comment, setComment] = useState('');
  const report = async () => {
    const choice = await Taro.showModal({
      title: '举报这篇内容？',
      content: '运营将复核该帖子，重复举报不会提高处理优先级。',
    });
    if (choice.confirm) await detail.act('report');
  };
  return (
    <View>
      <ResourceStatus loading={detail.loading} error={detail.error} onRetry={() => void detail.load()} />
      {detail.post && (
        <>
          <View className="feature-page-heading">
            <Text className="feature-eyebrow">COMMUNITY DETAIL</Text>
            <Text className="page-title">{detail.post.title}</Text>
          </View>
          <Text className="feed-caption">
            {detail.post.authorName}
            {detail.post.isAiGenerated ? ' · AI 生成' : ''}
          </Text>
          <FollowButton userId={detail.post.authorId} />
          {detail.post.imagePreviews.map((preview) => (
            <Image
              className="feed-post-image"
              key={preview}
              src={preview}
              mode="aspectFit"
              onClick={() => void Taro.previewImage({ current: preview, urls: detail.post!.imagePreviews })}
            />
          ))}
          <Text className="feed-card-body">{detail.post.body}</Text>
          <View className="feed-card-actions">
            <AppButton variant="secondary" disabled={detail.loading} onClick={() => void detail.act('like')}>
              {detail.state.liked ? '取消点赞' : '点赞'} {detail.post.likeCount}
            </AppButton>
            <AppButton variant="secondary" disabled={detail.loading} onClick={() => void detail.act('bookmark')}>
              {detail.state.bookmarked ? '取消收藏' : '收藏'}
            </AppButton>
            <AppButton variant="secondary" disabled={detail.loading} onClick={() => void report()}>
              举报
            </AppButton>
          </View>
          <Input
            className="feed-input"
            value={comment}
            onInput={(event) => setComment(event.detail.value)}
            maxlength={1000}
            placeholder="写下评论，审核后公开"
          />
          <AppButton
            disabled={!comment.trim() || detail.loading}
            onClick={() =>
              void detail.act('comment', comment.trim()).then((success) => {
                if (success) setComment('');
              })
            }
          >
            提交评论
          </AppButton>
          {detail.message && <InlineFeedback message={detail.message} tone="success" />}
          <ResourceStatus
            loading={detail.comments.loading}
            error={detail.comments.error}
            empty={!detail.comments.items.length}
            onRetry={() => void detail.comments.reload()}
          />
          {detail.comments.items.map((item) => (
            <View className="feed-composer" key={item.id}>
              <Text>{item.authorName}</Text>
              <Text className="feed-card-body">{item.body}</Text>
            </View>
          ))}
          {detail.comments.hasMore && (
            <AppButton variant="secondary" onClick={() => void detail.comments.loadMore()}>
              更多评论
            </AppButton>
          )}
        </>
      )}
      {!detail.post && !detail.loading && (
        <AppButton variant="secondary" onClick={() => void Taro.reLaunch({ url: '/pages/index/index' })}>
          返回首页
        </AppButton>
      )}
    </View>
  );
}
