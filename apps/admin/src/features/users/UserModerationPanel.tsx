import { useCallback, useEffect, useState } from 'react';
import type { AdminUser, UserStatus } from '@lumi/contracts';
import {
  listAdminUsers,
  listUserModerationActions,
  updateAdminUser,
  type UserModerationAction,
} from '../../services/moderation-api';

const statusLabels: Record<UserStatus, string> = { ACTIVE: '正常', SUSPENDED: '已封禁', DELETED: '已注销' };

export function UserModerationPanel() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  const [history, setHistory] = useState<Record<string, UserModerationAction[]>>({});

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

  const changeRole = async (item: AdminUser, next: 'USER' | 'MODERATOR' | 'ADMIN') => {
    if (next === item.role || !window.confirm(`将用户 ${item.id} 的角色调整为 ${next}，继续吗？`)) return;
    const reason = window.prompt('角色调整原因（必填）', '');
    if (reason === null || !reason.trim()) return;
    setBusyId(item.id);
    setError(undefined);
    try {
      const updated = await updateAdminUser(item.id, {
        role: next,
        expectedUpdatedAt: item.updatedAt,
        reason: reason.trim(),
      });
      setItems((current) => current.map((row) => (row.id === item.id ? updated : row)));
      const actions = await listUserModerationActions(item.id);
      setHistory((current) => ({ ...current, [item.id]: actions.items }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '角色调整失败，请刷新后重试');
    } finally {
      setBusyId(undefined);
    }
  };

  const showHistory = async (id: string) => {
    setError(undefined);
    try {
      const actions = await listUserModerationActions(id);
      setHistory((current) => ({ ...current, [id]: actions.items }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '审计记录读取失败');
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
          {items.map((item) => {
            const actionHistory = history[item.id];
            return (
              <article key={item.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.id}</p>
                  <p className="mt-1 text-xs text-lumi-muted">
                    {statusLabels[item.status]} · {item.role} · 帖子 {item.postCount} · 举报 {item.reportCount} · 注册{' '}
                    {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-lumi-muted">{item.status === 'ACTIVE' ? '可登录' : '会话已失效'}</span>
                  <select
                    className="border border-lumi-line bg-white px-2 py-2 text-xs"
                    aria-label={`调整 ${item.id} 的角色`}
                    value={item.role}
                    disabled={busyId === item.id || item.status === 'DELETED'}
                    onChange={(event) => void changeRole(item, event.target.value as 'USER' | 'MODERATOR' | 'ADMIN')}
                  >
                    <option value="USER">普通用户</option>
                    <option value="MODERATOR">审核员</option>
                    <option value="ADMIN">管理员</option>
                  </select>
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
                  <button
                    className="border border-lumi-line px-3 py-2 text-xs"
                    onClick={() => void showHistory(item.id)}
                  >
                    操作记录
                  </button>
                </div>
                {actionHistory && (
                  <div className="col-span-full border-l-2 border-lumi-line pl-3">
                    {actionHistory.length ? (
                      actionHistory.map((action) => (
                        <p key={action.id} className="py-1 text-xs text-lumi-muted">
                          {new Date(action.createdAt).toLocaleString('zh-CN')} · {action.fromStatus}/{action.fromRole} →{' '}
                          {action.toStatus}/{action.toRole} · {action.reason} · 操作者 {action.actorId ?? '账号已删除'}
                        </p>
                      ))
                    ) : (
                      <p className="py-1 text-xs text-lumi-muted">暂无处罚记录</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
