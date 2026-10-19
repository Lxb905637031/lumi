import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommunityPost } from '@lumi/contracts';
import { useCursorList } from '../../hooks/useCursorList';
import { hasSession } from '../../services/http-client';
import { ensureLogin } from '../auth/auth.api';
import {
  addPostComment,
  getPost,
  getPostState,
  listComments,
  reportPost,
  setPostBookmark,
  setPostLike,
} from './community.api';

export function usePostDetail(id: string) {
  const [post, setPost] = useState<CommunityPost>();
  const [state, setState] = useState({ liked: false, bookmarked: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const busy = useRef(false);
  const fetchComments = useCallback((cursor?: string) => listComments(id, cursor), [id]);
  const comments = useCursorList(fetchComments);
  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setPost(await getPost(id));
      if (hasSession()) setState(await getPostState(id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '内容不存在或暂不可用');
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (kind: 'like' | 'bookmark' | 'comment' | 'report', body?: string) => {
    if (busy.current) return false;
    busy.current = true;
    setLoading(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await ensureLogin();
      if (kind === 'like') {
        const next = await setPostLike(id, !state.liked);
        setState((current) => ({ ...current, ...next }));
      }
      if (kind === 'bookmark') {
        const next = await setPostBookmark(id, !state.bookmarked);
        setState((current) => ({ ...current, ...next }));
      }
      if (kind === 'comment') {
        await addPostComment(id, body ?? '');
        setMessage('评论已提交审核');
      }
      if (kind === 'report') {
        await reportPost(id, 'OTHER');
        setMessage('举报已提交，运营将审核处理');
      }
      setPost(await getPost(id));
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败，请重试');
      return false;
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };
  return { post, state, loading, error, message, comments, load, act };
}
