import { useEffect, useState } from 'react';
import { Text, View } from '@tarojs/components';
import type { CommunityComment } from '@lumi/contracts';
import { ResourceStatus } from '../../../components/ui/ResourceStatus/ResourceStatus';
import { getPostComment } from '../community.api';

// Fetch the exact comment independently of the paginated list, including older comments.
export function NotificationComment({ postId, commentId }: { postId: string; commentId: string }) {
  const [comment, setComment] = useState<CommunityComment>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setComment(undefined);
    setError(undefined);
    void getPostComment(postId, commentId)
      .then(
        (value) => {
          if (active) setComment(value);
        },
        (reason) => {
          if (active) setError(reason instanceof Error ? reason.message : '评论暂不可查看');
        },
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [postId, commentId, attempt]);
  return (
    <View className="feed-composer">
      <Text>消息中的评论</Text>
      <ResourceStatus loading={loading} error={error} onRetry={() => setAttempt((value) => value + 1)} />
      {comment && (
        <View>
          <Text>{comment.authorName}</Text>
          <Text className="feed-card-body">{comment.body}</Text>
        </View>
      )}
    </View>
  );
}
