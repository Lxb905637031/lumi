import { Image, Text, View } from '@tarojs/components';
import type { CommunityPost } from '@lumi/contracts';
import Taro from '@tarojs/taro';
import '../../feed/components/InspirationGrid.scss';

export function PostCard({
  post,
  mediaVariant = 'standard',
}: {
  post: CommunityPost;
  mediaVariant?: 'standard' | 'portrait';
}) {
  return (
    <View
      className="feed-inspiration"
      onClick={() => void Taro.navigateTo({ url: '/pages/post/index?id=' + encodeURIComponent(post.id) })}
    >
      {post.imagePreviews[0] && (
        <Image
          className={`feed-post-image feed-post-image--${mediaVariant}`}
          src={post.imagePreviews[0]}
          mode="aspectFill"
          lazyLoad
        />
      )}
      <Text className="feed-card-title">{post.title}</Text>
      <Text className="feed-card-body">{post.body}</Text>
      <Text className="feed-card-meta">
        {post.authorName} · {post.likeCount} 赞
      </Text>
      {post.isAiGenerated && <Text className="feed-card-meta">AI 生成参考</Text>}
    </View>
  );
}
