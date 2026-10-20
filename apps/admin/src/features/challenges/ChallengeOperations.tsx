import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { ModerationQueueItem } from '@lumi/contracts';
import {
  closeAdminChallenge,
  createAdminChallenge,
  listAdminChallenges,
  listModerationPosts,
  publishAdminChallenge,
  updateModerationStatus,
  type AdminChallenge,
} from '../../services/moderation-api';

const statusLabels: Record<AdminChallenge['status'], string> = {
  DRAFT: '草稿',
  PUBLISHED: '进行中',
  CLOSED: '已关闭',
  ARCHIVED: '已归档',
};

function localDateTime(offsetHours: number) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function ChallengeOperations() {
  const [challenges, setChallenges] = useState<AdminChallenge[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [posts, setPosts] = useState<ModerationQueueItem[]>([]);
  const [postCursor, setPostCursor] = useState<string | null>(null);
  const [nextChallengeCursor, setNextChallengeCursor] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(() => localDateTime(1));
  const [endsAt, setEndsAt] = useState(() => localDateTime(24 * 8));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async (cursor?: string, append = false) => {
    setLoading(true);
    setError('');
    try {
      const page = await listAdminChallenges(undefined, cursor);
      setChallenges((current) => (append ? [...current, ...page.items] : page.items));
      setNextChallengeCursor(page.nextCursor);
      return page.items;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '挑战列表读取失败');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().then((items) => setSelectedId((current) => current || items[0]?.id || ''));
  }, [refresh]);

  const loadPosts = useCallback(async (challengeId: string, cursor?: string, append = false) => {
    if (!challengeId) {
      setPosts([]);
      setPostCursor(null);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const page = await listModerationPosts('PENDING', cursor, challengeId);
      setPosts((current) => (append ? [...current, ...page.items] : page.items));
      setPostCursor(page.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '投稿审核列表读取失败');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts(selectedId);
  }, [loadPosts, selectedId]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const created = await createAdminChallenge({
        slug: slug.trim().toLowerCase(),
        title: title.trim(),
        description: description.trim(),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      setSelectedId(created.id);
      setTitle('');
      setSlug('');
      setDescription('');
      setNotice('挑战草稿已创建');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '挑战草稿创建失败');
    } finally {
      setBusy(false);
    }
  };

  const transition = async (item: AdminChallenge, action: 'publish' | 'close') => {
    const message = action === 'publish' ? `发布“${item.title}”？` : `关闭“${item.title}”？关闭后用户不能再投稿。`;
    if (!window.confirm(message)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (action === 'publish') await publishAdminChallenge(item.id);
      else await closeAdminChallenge(item.id);
      setNotice(action === 'publish' ? '挑战已发布' : '挑战已关闭');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '挑战状态更新失败');
    } finally {
      setBusy(false);
    }
  };

  const decidePost = async (item: ModerationQueueItem, status: 'APPROVED' | 'REJECTED') => {
    const reason = window.prompt(status === 'APPROVED' ? '通过说明（可留空）' : '拒绝原因（必填）', '');
    if (reason === null || (status === 'REJECTED' && !reason.trim())) return;
    setBusy(true);
    setError('');
    try {
      await updateModerationStatus(item.id, status, reason);
      setPosts((current) => current.filter((post) => post.id !== item.id));
      setNotice(status === 'APPROVED' ? '投稿已通过审核' : '投稿已拒绝');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '审核结果未确认，请刷新后核对');
    } finally {
      setBusy(false);
    }
  };

  const selected = challenges.find((item) => item.id === selectedId);

  return (
    <section className="mt-10 border-t border-lumi-line pt-8" aria-labelledby="challenge-ops-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-lumi-muted">COMMUNITY PROGRAMS</p>
          <h2 className="mt-2 text-xl font-semibold" id="challenge-ops-title">
            挑战运营
          </h2>
          <p className="mt-1 text-sm text-lumi-muted">维护挑战周期，并在同一审核记录中处理用户投稿。</p>
        </div>
        <button className="border border-lumi-line px-3 py-2 text-sm" onClick={() => void refresh()} disabled={loading}>
          刷新列表
        </button>
      </header>
      {error && (
        <p className="mt-4 border-l-2 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p
          className="mt-4 border-l-2 border-emerald-700 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          role="status"
        >
          {notice}
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
        <div>
          <div className="flex items-center justify-between border-b border-lumi-line pb-3">
            <h3 className="font-semibold">挑战目录</h3>
            <span className="text-xs text-lumi-muted">{loading ? '读取中' : `${challenges.length} 项`}</span>
          </div>
          {loading && !challenges.length ? <p className="py-8 text-sm text-lumi-muted">正在读取挑战…</p> : null}
          {!loading && !challenges.length ? (
            <p className="py-8 text-sm text-lumi-muted">暂无挑战，请创建草稿。</p>
          ) : null}
          <div className="divide-y divide-lumi-line">
            {challenges.map((item) => (
              <article
                className={`py-4 ${item.id === selectedId ? 'border-l-2 border-lumi-brand pl-3' : ''}`}
                key={item.id}
              >
                <button className="block w-full text-left" onClick={() => setSelectedId(item.id)}>
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{item.title}</span>
                    <span className="text-xs text-lumi-muted">{statusLabels[item.status]}</span>
                  </span>
                  <span className="mt-1 block text-xs text-lumi-muted">
                    {item.slug} · {item.participantCount} 位参与 · {item.pendingPostCount} 篇待审投稿
                  </span>
                  <span className="mt-1 block text-xs text-lumi-muted">
                    {new Date(item.startsAt).toLocaleString('zh-CN')} 至 {new Date(item.endsAt).toLocaleString('zh-CN')}
                  </span>
                </button>
                <div className="mt-3 flex gap-2">
                  {item.status === 'DRAFT' && (
                    <button
                      className="bg-lumi-ink px-3 py-2 text-xs text-white disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void transition(item, 'publish')}
                    >
                      发布
                    </button>
                  )}
                  {item.status === 'PUBLISHED' && (
                    <button
                      className="border border-lumi-line px-3 py-2 text-xs disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void transition(item, 'close')}
                    >
                      关闭挑战
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {nextChallengeCursor && (
            <button
              className="mt-3 w-full border border-lumi-line px-4 py-3 text-sm"
              disabled={loading}
              onClick={() => void refresh(nextChallengeCursor, true)}
            >
              加载更多挑战
            </button>
          )}
        </div>

        <form className="border-lumi-line lg:border-l lg:pl-6" onSubmit={(event) => void save(event)}>
          <h3 className="font-semibold">新建挑战草稿</h3>
          <label className="mt-4 block text-xs font-medium text-lumi-muted" htmlFor="challenge-title">
            标题
          </label>
          <input
            id="challenge-title"
            className="mt-2 w-full border border-lumi-line bg-white px-3 py-2.5 text-sm"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={100}
            disabled={busy}
          />
          <label className="mt-4 block text-xs font-medium text-lumi-muted" htmlFor="challenge-slug">
            唯一标识
          </label>
          <input
            id="challenge-slug"
            className="mt-2 w-full border border-lumi-line bg-white px-3 py-2.5 text-sm"
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            required
            minLength={3}
            maxLength={80}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            disabled={busy}
          />
          <label className="mt-4 block text-xs font-medium text-lumi-muted" htmlFor="challenge-description">
            参与说明
          </label>
          <textarea
            id="challenge-description"
            className="mt-2 min-h-24 w-full border border-lumi-line bg-white px-3 py-2.5 text-sm"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            maxLength={3000}
            disabled={busy}
          />
          <div className="mt-4 grid grid-cols-1 gap-3">
            <label className="text-xs font-medium text-lumi-muted" htmlFor="challenge-start">
              开始时间
              <input
                id="challenge-start"
                className="mt-2 block w-full border border-lumi-line bg-white px-3 py-2.5 text-sm"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
                disabled={busy}
              />
            </label>
            <label className="text-xs font-medium text-lumi-muted" htmlFor="challenge-end">
              结束时间
              <input
                id="challenge-end"
                className="mt-2 block w-full border border-lumi-line bg-white px-3 py-2.5 text-sm"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                required
                disabled={busy}
              />
            </label>
          </div>
          <button
            className="mt-5 bg-lumi-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            type="submit"
            disabled={busy}
          >
            保存草稿
          </button>
        </form>
      </div>

      <div className="mt-8 border-t border-lumi-line pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-semibold">投稿审核</h3>
            <p className="mt-1 text-sm text-lumi-muted">
              {selected ? `仅显示“${selected.title}”的待审内容。` : '选择挑战后读取对应投稿。'}
            </p>
          </div>
          {selected && (
            <button
              className="border border-lumi-line px-3 py-2 text-sm"
              disabled={busy}
              onClick={() => void loadPosts(selected.id)}
            >
              刷新投稿
            </button>
          )}
        </div>
        {!selected ? (
          <p className="py-6 text-sm text-lumi-muted">请选择一个挑战。</p>
        ) : !posts.length && !busy ? (
          <p className="py-6 text-sm text-lumi-muted">该挑战没有待审核投稿。</p>
        ) : null}
        <div className="divide-y divide-lumi-line">
          {posts.map((post) => (
            <article className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" key={post.id}>
              <div className="min-w-0">
                <p className="font-medium">{post.title}</p>
                <p className="mt-1 text-sm text-lumi-muted">{post.bodyPreview}</p>
                <p className="mt-2 text-xs text-lumi-muted">
                  投稿者 {post.submittedBy} · {new Date(post.createdAt).toLocaleString('zh-CN')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="bg-lumi-ink px-3 py-2 text-xs text-white disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void decidePost(post, 'APPROVED')}
                >
                  通过
                </button>
                <button
                  className="border border-lumi-line px-3 py-2 text-xs disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void decidePost(post, 'REJECTED')}
                >
                  拒绝
                </button>
              </div>
            </article>
          ))}
        </div>
        {postCursor && selected && (
          <button
            className="mt-3 w-full border border-lumi-line px-4 py-3 text-sm"
            disabled={busy}
            onClick={() => void loadPosts(selected.id, postCursor, true)}
          >
            加载更多投稿
          </button>
        )}
      </div>
    </section>
  );
}
