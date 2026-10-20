import { useCallback, useEffect, useState } from 'react';
import type { AdminUser, UserStatus } from '@lumi/contracts';
import { listAdminUsers, updateAdminUser } from '../../services/moderation-api';

const statusLabels: Record<UserStatus, string> = { ACTIVE: '正常', SUSPENDED: '已封禁', DELETED: '已注销' };

export function UserModerationPanel() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const page = await listAdminUsers(status, search);
      setItems(page.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '用户列表读取失败');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = async (item: AdminUser, next: 'ACTIVE' | 'SUSPENDED') => {
    const reason = window.prompt(next === 'SUSPENDED' ? '封禁原因（必填）' : '解封原因（必填）', '');
    if (reason === null || !reason.trim()) return;
    setBusyId(item.id);
    setError(undefined);
    try {
      const updated = await updateAdminUser(item.id, {
        status: next,
        expectedUpdatedAt: item.updatedAt,
        reason: reason.trim(),
      });
      setItems((current) => current.map((row) => (row.id === item.id ? updated : row)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '用户状态更新失败，请刷新后重试');
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <section className="mt-10 border-t border-lumi-line pt-6" aria-labelledby="user-moderation-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="user-moderation-title" className="text-xl font-semibold">
            用户与处罚
          </h2>
          <p className="mt-1 text-sm text-lumi-muted">封禁会立即撤销会话，所有处罚和解封都写入审计记录。</p>
        </div>
        <button className="border border-lumi-line px-3 py-2 text-sm" onClick={() => void load()} disabled={loading}>
          刷新
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(['ACTIVE', 'SUSPENDED'] as const).map((value) => (
          <button
            key={value}
            className={`border px-3 py-2 text-xs ${status === value ? 'border-lumi-ink bg-lumi-ink text-white' : 'border-lumi-line'}`}
            onClick={() => setStatus(value)}
          >
            {statusLabels[value]}
          </button>
        ))}
        <input
          className="min-w-52 flex-1 border border-lumi-line bg-lumi-canvas px-3 py-2 text-sm outline-none focus:border-lumi-brand"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="按用户 ID 搜索"
          maxLength={100}
          aria-label="按用户 ID 搜索"
        />
      </div>
      {error && (
        <p
          className="mt-4 border-l-2 border-lumi-brand bg-lumi-brand-soft px-3 py-2 text-sm text-lumi-brand"
          role="alert"
        >
          {error}
        </p>
      )}
      {loading && !items.length ? (
        <p className="py-8 text-sm text-lumi-muted" role="status">
          正在读取用户列表…
        </p>
      ) : !items.length ? (
        <p className="py-8 text-sm text-lumi-muted">当前筛选没有用户。</p>
      ) : (
        <div className="mt-4 divide-y divide-lumi-line">
          {items.map((item) => (
            <article key={item.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.id}</p>
                <p className="mt-1 text-xs text-lumi-muted">
                  {statusLabels[item.status]} · {item.role} · 帖子 {item.postCount} · 举报 {item.reportCount} · 注册{' '}
                  {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-lumi-muted">{item.status === 'ACTIVE' ? '可登录' : '会话已失效'}</span>
                {item.status === 'ACTIVE' && (
                  <button
                    className="bg-lumi-ink px-3 py-2 text-xs text-white disabled:opacity-50"
                    disabled={busyId === item.id}
                    onClick={() => void changeStatus(item, 'SUSPENDED')}
                  >
                    封禁
                  </button>
                )}
                {item.status === 'SUSPENDED' && (
                  <button
                    className="border border-lumi-line px-3 py-2 text-xs disabled:opacity-50"
                    disabled={busyId === item.id}
                    onClick={() => void changeStatus(item, 'ACTIVE')}
                  >
                    解封
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
