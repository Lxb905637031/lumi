import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { ResourceStatus } from '../../../components/ui/ResourceStatus/ResourceStatus';
import { useCursorList } from '../../../hooks/useCursorList';
import { listBookmarks, listMyPosts, removePost } from '../community.api';
import { PostCard } from './PostCard';
import '../../profile/components/ProfilePanel.scss';

export function PostCollection({ collection }: { collection: 'mine' | 'bookmarks' }) {
  const list = useCursorList(collection === 'mine' ? listMyPosts : listBookmarks);
  const remove = async (id: string) => {
    const choice = await Taro.showModal({ title: '删除帖子？', content: '删除后不再出现在公开 Feed。' });
    if (!choice.confirm) return;
    try {
      await removePost(id);
      await list.reload();
    } catch (reason) {
      void Taro.showToast({ title: reason instanceof Error ? reason.message : '删除失败', icon: 'none' });
    }
  };
  const statusNames = { PENDING: '审核中', APPROVED: '已公开', REJECTED: '已拒绝', REMOVED: '已下架' };
  return (
    <View>
      <View className="feature-page-heading">
        <Text className="feature-eyebrow">COMMUNITY</Text>
        <Text className="page-title">{collection === 'mine' ? '我的发布' : '我的收藏'}</Text>
        <Text className="page-description">
          {collection === 'mine' ? '草稿、审核状态和已发布内容都在这里继续。' : '留住你想再次尝试的穿搭灵感。'}
        </Text>
      </View>
      <ResourceStatus
        loading={list.loading}
        error={list.error}
        empty={!list.items.length}
        onRetry={() => void list.reload()}
      />
      {list.items.map((post) => (
        <View className="post-collection-item" key={post.id}>
          {post.moderationStatus === 'APPROVED' ? <PostCard post={post} /> : <Text>{post.title}</Text>}
          <Text className="feed-caption">{statusNames[post.moderationStatus]}</Text>
          {collection === 'mine' && (
            <AppButton variant="secondary" onClick={() => void remove(post.id)}>
              删除
            </AppButton>
          )}
        </View>
      ))}
      {list.hasMore && (
        <AppButton variant="secondary" onClick={() => void list.loadMore()}>
          加载更多
        </AppButton>
      )}
    </View>
  );
}
