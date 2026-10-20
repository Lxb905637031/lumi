import { Input, ScrollView, Text, View } from '@tarojs/components';
import { useCallback, useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { ResourceStatus } from '../../../components/ui/ResourceStatus/ResourceStatus';
import { useCursorList } from '../../../hooks/useCursorList';
import { listCommunityPosts, listCommunityTopics } from '../../community/community.api';
import { PostCard } from '../../community/components/PostCard';
import { FeedEmptyState } from './FeedEmptyState';
import './InspirationGrid.scss';

export function InspirationGrid() {
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const fetchPosts = useCallback((cursor?: string) => listCommunityPosts(cursor, search, topic), [search, topic]);
  const feed = useCursorList(fetchPosts);

  useEffect(() => {
    void listCommunityTopics()
      .then((page) => setTopics(page.items))
      .catch(() => setTopics([]));
  }, []);

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
      <Input
        className="feed-input feed-search"
        value={search}
        placeholder="搜索穿搭、单品或话题"
        confirmType="search"
        onInput={(event) => setSearch(event.detail.value)}
      />
      {!!topics.length && (
        <ScrollView className="feed-topics" scrollX enhanced showScrollbar={false}>
          <Text className={`feed-topic ${!topic ? 'feed-topic--active' : ''}`} onClick={() => setTopic('')}>
            全部
          </Text>
          {topics.map((item) => (
            <Text
              key={item}
              className={`feed-topic ${topic === item ? 'feed-topic--active' : ''}`}
              onClick={() => setTopic(topic === item ? '' : item)}
            >
              #{item}
            </Text>
          ))}
        </ScrollView>
      )}
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
