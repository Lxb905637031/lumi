import { useCallback, useEffect, useRef, useState } from 'react';
import type { CursorPage } from '@lumi/contracts';

export function useCursorList<T>(fetchPage: (cursor?: string) => Promise<CursorPage<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const busy = useRef(false);
  const mounted = useRef(true);

  const load = useCallback(
    async (cursor?: string) => {
      if (busy.current) return;
      busy.current = true;
      setLoading(true);
      setError(undefined);
      try {
        const page = await fetchPage(cursor);
        if (!mounted.current) return;
        setItems((previous) => (cursor ? [...previous, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
      } catch (reason) {
        if (mounted.current) setError(reason instanceof Error ? reason.message : '加载失败，请重试');
      } finally {
        busy.current = false;
        if (mounted.current) setLoading(false);
      }
    },
    [fetchPage],
  );

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  return {
    items,
    loading,
    error,
    reload: () => load(),
    loadMore: () => (nextCursor ? load(nextCursor) : Promise.resolve()),
    hasMore: nextCursor !== null,
  };
}
