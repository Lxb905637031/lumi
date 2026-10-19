import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { ResourceStatus } from '../../../components/ui/ResourceStatus/ResourceStatus';
import { useCursorList } from '../../../hooks/useCursorList';
import { listCommunityPosts } from '../../community/community.api';
import { PostCard } from '../../community/components/PostCard';
import './InspirationGrid.scss';

export function InspirationGrid() {
  const feed = useCursorList(listCommunityPosts);
  return (
    <View className="inspiration-feed">
      <View className="feed-toolbar">
        <View>
          <Text className="feed-heading">推荐</Text>
          <Text className="feed-caption">审核通过的穿搭灵感</Text>
        </View>
        <AppButton variant="secondary" onClick={() => void Taro.navigateTo({ url: '/pages/publish/index' })}>
          发布穿搭
        </AppButton>
      </View>
      <ResourceStatus
        loading={feed.loading}
        error={feed.error}
        empty={!feed.items.length}
        onRetry={() => void feed.reload()}
      />
      <View className="inspiration-grid">
        {feed.items.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </View>
      {feed.hasMore && (
        <AppButton loading={feed.loading} variant="secondary" onClick={() => void feed.loadMore()}>
          加载更多
        </AppButton>
      )}
    </View>
  );
}
