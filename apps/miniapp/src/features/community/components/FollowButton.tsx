import { useEffect, useRef, useState } from 'react';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { ensureLogin } from '../../auth/auth.api';
import { getFollowState, setFollow } from '../follows.api';

export function FollowButton({ userId }: { userId: string }) {
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void getFollowState(userId)
      .then((state) => {
        if (mounted.current) setFollowing(state.following);
      })
      .catch(() => undefined);
    return () => {
      mounted.current = false;
    };
  }, [userId]);
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await ensureLogin();
      const state = await setFollow(userId, !following);
      if (mounted.current) setFollowing(state.following);
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : '关注操作失败，请重试');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <>
      <AppButton compact variant="secondary" loading={busy} onClick={() => void toggle()}>
        {following ? '取消关注' : '关注作者'}
      </AppButton>
      {error && <InlineFeedback message={error} tone="error" />}
    </>
  );
}
