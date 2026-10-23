import { useEffect, useMemo, useState } from 'react';
import type { Announcement } from '@lumi/contracts';
import {
  createAnnouncement,
  listAnnouncements,
  publishAnnouncement,
  updateAnnouncement,
} from '../../services/moderation-api';

function newKey() {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `announcement-${Date.now()}`;
}

export function AnnouncementComposer() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [selected, setSelected] = useState<Announcement>();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selectedDraft = useMemo(() => selected?.status === 'DRAFT', [selected]);
  const canPublish = selected?.status === 'DRAFT' || selected?.status === 'SENDING';

  const refresh = () =>
    listAnnouncements().then((page) => {
      setItems(page.items);
      setSelected((current) => (current ? (page.items.find((item) => item.id === current.id) ?? current) : current));
    });
  useEffect(() => {
    void refresh().catch(() => setError('公告列表加载失败'));
  }, []);

  useEffect(() => {
    if (!items.some((item) => item.status === 'SENDING')) return;
    const timer = window.setInterval(() => void refresh().catch(() => setError('公告状态刷新失败')), 1500);
    return () => window.clearInterval(timer);
  }, [items]);

  const reset = () => {
    setSelected(undefined);
    setTitle('');
    setBody('');
    setError('');
    setNotice('');
  };

  const save = async () => {
    if (!title.trim() || !body.trim()) {
      setError('请填写公告标题和正文');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = selected
        ? await updateAnnouncement(selected.id, { expectedVersion: selected.version, title, body })
        : await createAnnouncement({ idempotencyKey: newKey(), title, body });
      setSelected(next);
      setTitle(next.title);
      setBody(next.body);
      setNotice('草稿已保存');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!selected || !canPublish) return;
    if (
      !window.confirm(
        `将向 ${selected.status === 'DRAFT' ? '当前全部活跃用户' : '剩余未送达用户'}发送“${title.trim()}”，继续吗？`,
      )
    )
      return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await publishAnnouncement(selected.id, selected.version);
      setSelected(next);
      setNotice('公告已进入发送队列');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '发布失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10 border border-lumi-line bg-lumi-surface p-5 sm:p-7" aria-label="公告发布">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-lumi-muted">ANNOUNCEMENTS</p>
          <h2 className="mt-2 text-xl font-semibold">公告中心</h2>
          <p className="mt-1 text-sm text-lumi-muted">先保存草稿，确认内容后发送给当前活跃用户。</p>
        </div>
        <button className="border border-lumi-line px-3 py-2 text-xs font-medium" onClick={reset} disabled={busy}>
          新建草稿
        </button>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <label className="block text-xs font-medium text-lumi-muted" htmlFor="announcement-title">
            标题
          </label>
          <input
            id="announcement-title"
            className="mt-2 w-full border border-lumi-line bg-lumi-canvas px-3 py-3 text-sm outline-none focus:border-lumi-brand"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            disabled={busy || Boolean(selected && !selectedDraft)}
          />
          <label className="mt-5 block text-xs font-medium text-lumi-muted" htmlFor="announcement-body">
            正文
          </label>
          <textarea
            id="announcement-body"
            className="mt-2 min-h-40 w-full resize-y border border-lumi-line bg-lumi-canvas px-3 py-3 text-sm leading-6 outline-none focus:border-lumi-brand"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={5000}
            disabled={busy || Boolean(selected && !selectedDraft)}
          />
          {error && (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="mt-3 text-sm text-lumi-brand" role="status">
              {notice === '公告已进入发送队列' && selected?.status === 'SENDING'
                ? `发送中 ${selected.deliveredCount}/${selected.recipientCount ?? 0} 位活跃用户`
                : notice === '公告已进入发送队列'
                  ? `已发送 ${selected?.deliveredCount ?? 0}/${selected?.recipientCount ?? 0} 位活跃用户`
                  : notice}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="bg-lumi-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => void save()}
              disabled={busy || Boolean(selected && !selectedDraft)}
            >
              保存草稿
            </button>
            <button
              className="border border-lumi-brand px-4 py-2.5 text-sm font-medium text-lumi-brand disabled:opacity-50"
              onClick={() => void publish()}
              disabled={busy || !canPublish}
            >
              确认发布
            </button>
          </div>
        </div>
        <aside className="border-l border-lumi-line pl-5">
          <p className="text-xs font-medium text-lumi-muted">历史公告</p>
          <div className="mt-3 space-y-2">
            {items.length === 0 && <p className="text-sm text-lumi-muted">暂无公告</p>}
            {items.map((item) => (
              <button
                key={item.id}
                className={`block w-full border px-3 py-3 text-left ${selected?.id === item.id ? 'border-lumi-brand' : 'border-lumi-line'}`}
                onClick={() => {
                  setSelected(item);
                  setTitle(item.title);
                  setBody(item.body);
                  setError('');
                  setNotice('');
                }}
              >
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="mt-1 block text-xs text-lumi-muted">
                  {item.status === 'DRAFT'
                    ? '草稿'
                    : item.status === 'SENDING'
                      ? '发送中'
                      : `已发送 ${item.recipientCount} 人`}
                </span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
