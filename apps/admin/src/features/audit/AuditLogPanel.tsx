import { useCallback, useEffect, useState } from 'react';
import { listAdminAudit, type AdminAuditItem, type AdminAuditType } from '../../services/moderation-api';

const labels: Record<AdminAuditType, string> = {
  POST: '帖子',
  COMMENT: '评论',
  MEDIA: '图片',
  USER: '用户',
};

export function AuditLogPanel() {
  const [draftType, setDraftType] = useState<AdminAuditType | ''>('');
  const [draftActorId, setDraftActorId] = useState('');
  const [draftTargetId, setDraftTargetId] = useState('');
  const [filters, setFilters] = useState<{ type?: AdminAuditType; actorId: string; targetId: string }>({
    actorId: '',
    targetId: '',
  });
  const [items, setItems] = useState<AdminAuditItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(
    async (cursor?: string, append = false) => {
      setLoading(true);
      setError(undefined);
      try {
        const page = await listAdminAudit({ ...filters, cursor });
        setItems((current) => (append ? [...current, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '审计记录读取失败');
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      className="mt-6 rounded-lg border border-lumi-line bg-lumi-surface p-5 sm:p-6"
      aria-labelledby="audit-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold" id="audit-title">
            操作审计
          </h2>
          <p className="mt-1 text-sm text-lumi-muted">统一查看帖子、评论、图片和用户状态变更。</p>
        </div>
        <button
          type="button"
          className="rounded-md border border-lumi-line px-3 py-2 text-sm"
          onClick={() => void load()}
          disabled={loading}
        >
          刷新
        </button>
      </div>
      <form
        className="mt-4 grid gap-2 sm:grid-cols-[160px_1fr_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters({
            type: draftType || undefined,
            actorId: draftActorId.trim(),
            targetId: draftTargetId.trim(),
          });
        }}
      >
        <select
          className="rounded-md border border-lumi-line bg-white px-3 py-2 text-sm"
          value={draftType}
          onChange={(event) => setDraftType(event.target.value as AdminAuditType | '')}
          aria-label="审计类型"
        >
          <option value="">全部类型</option>
          {(Object.keys(labels) as AdminAuditType[]).map((key) => (
            <option key={key} value={key}>
              {labels[key]}
            </option>
          ))}
        </select>
        <input
          className="rounded-md border border-lumi-line px-3 py-2 text-sm"
          placeholder="操作者 ID"
          value={draftActorId}
          onChange={(event) => setDraftActorId(event.target.value)}
        />
        <input
          className="rounded-md border border-lumi-line px-3 py-2 text-sm"
          placeholder="目标 ID"
          value={draftTargetId}
          onChange={(event) => setDraftTargetId(event.target.value)}
        />
        <button type="submit" className="rounded-md bg-lumi-ink px-4 py-2 text-sm font-medium text-white">
          查询
        </button>
      </form>
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
          正在读取审计记录…
        </p>
      ) : !items.length ? (
        <p className="py-8 text-sm text-lumi-muted">当前筛选没有记录。</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-lumi-line text-xs text-lumi-muted">
              <tr>
                <th className="py-3 pr-4">类型</th>
                <th className="py-3 pr-4">状态变化</th>
                <th className="py-3 pr-4">操作者</th>
                <th className="py-3 pr-4">目标</th>
                <th className="py-3">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lumi-line">
              {items.map((item) => (
                <tr key={`${item.type}-${item.id}`}>
                  <td className="py-3 pr-4">{labels[item.type]}</td>
                  <td className="py-3 pr-4">
                    {item.fromStatus} → {item.toStatus}
                    {item.reason ? <span className="ml-2 text-xs text-lumi-muted">{item.reason}</span> : null}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">{item.actorId}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{item.targetId}</td>
                  <td className="py-3 text-xs text-lumi-muted">{new Date(item.createdAt).toLocaleString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nextCursor && (
        <button
          type="button"
          className="mt-4 rounded-md border border-lumi-line px-3 py-2 text-sm"
          onClick={() => void load(nextCursor, true)}
          disabled={loading}
        >
          加载更多
        </button>
      )}
    </section>
  );
}
