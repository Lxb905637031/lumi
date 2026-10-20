import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { ResourceStatus } from '../../../components/ui/ResourceStatus/ResourceStatus';
import { useCursorList } from '../../../hooks/useCursorList';
import { listCommunityPosts } from '../../community/community.api';
import { PostCard } from '../../community/components/PostCard';
import { FeedEmptyState } from './FeedEmptyState';
import './InspirationGrid.scss';

export function InspirationGrid() {
  const feed = useCursorList(listCommunityPosts);
  return (
    <View className="inspiration-feed">
      <View className="feed-toolbar">
        <View>
          <Text className="feed-heading">穿搭灵感</Text>
          <Text className="feed-caption">审核通过的穿搭灵感</Text>
        </View>
        <AppButton compact variant="secondary" onClick={() => void Taro.navigateTo({ url: '/pages/publish/index' })}>
          发布穿搭
        </AppButton>
      </View>
      <ResourceStatus
        loading={feed.loading && !feed.items.length}
        error={feed.error}
        onRetry={() => void feed.reload()}
      />
      {!feed.loading && !feed.error && !feed.items.length && <FeedEmptyState />}
      <View className="inspiration-grid">
        {[feed.items.filter((_, index) => index % 2 === 0), feed.items.filter((_, index) => index % 2 === 1)].map(
          (column, columnIndex) => (
            <View className="inspiration-column" key={columnIndex}>
              {column.map((post, index) => (
                <PostCard
                  key={post.id}
                  post={post}
                  mediaVariant={(index + columnIndex) % 3 === 0 ? 'portrait' : 'standard'}
                />
              ))}
            </View>
          ),
        )}
      </View>
      {feed.hasMore && (
        <AppButton block loading={feed.loading} variant="secondary" onClick={() => void feed.loadMore()}>
          加载更多
        </AppButton>
      )}
    </View>
  );
}
