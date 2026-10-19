import { useEffect, useState } from 'react';
import type { ModerationQueueItem, ModerationStatus } from '@lumi/contracts';
import { listModerationPosts, updateModerationStatus } from '../../services/moderation-api';

const statusLabels: Record<ModerationStatus, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  REMOVED: '已下架',
};

const actionLabels = {
  APPROVED: '通过',
  REJECTED: '拒绝',
  REMOVED: '下架',
} as const;

export function ReviewQueue() {
  return (
    <section
      className="mt-6 rounded-lg border border-lumi-line bg-lumi-surface p-5 sm:p-6"
      aria-labelledby="review-queue-title"
    >
      <QueueContent />
    </section>
  );
}

function QueueContent() {
  const [items, setItems] = useState<ModerationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [updatingId, setUpdatingId] = useState<string>();

  useEffect(() => {
    let active = true;
    void listModerationPosts()
      .then((page) => {
        if (active) setItems(page.items);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : '审核队列加载失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleStatusChange = async (id: string, status: Exclude<ModerationStatus, 'PENDING'>) => {
    setUpdatingId(id);
    setError(undefined);
    try {
      const updated = await updateModerationStatus(id, status);
      setItems((current) => current.map((item) => (item.id === id ? updated : item)));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '审核操作失败');
    } finally {
      setUpdatingId(undefined);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold" id="review-queue-title">
          审核队列
        </h2>
        <span className="text-sm text-lumi-muted">{loading ? '加载中' : `${items.length} 条`}</span>
      </div>
      {error && (
        <p className="mt-4 border-l-2 border-lumi-brand bg-lumi-brand-soft px-3 py-2 text-sm text-lumi-brand">
          {error}
        </p>
      )}
      {loading ? (
        <p className="mt-4 py-8 text-sm text-lumi-muted">正在读取服务端审核队列…</p>
      ) : (
        <ServerTable items={items} updatingId={updatingId} onStatusChange={handleStatusChange} />
      )}
    </>
  );
}

function ServerTable({
  items,
  updatingId,
  onStatusChange,
}: {
  items: ModerationQueueItem[];
  updatingId?: string;
  onStatusChange: (id: string, status: Exclude<ModerationStatus, 'PENDING'>) => Promise<void>;
}) {
  if (!items.length) return <p className="mt-4 py-8 text-sm text-lumi-muted">当前没有待处理的服务端内容。</p>;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-y border-lumi-line text-lumi-muted">
            <th className="py-3 pr-4 font-medium">内容</th>
            <th className="py-3 pr-4 font-medium">提交者</th>
            <th className="py-3 pr-4 font-medium">状态</th>
            <th className="py-3 pr-4 font-medium">时间</th>
            <th className="py-3 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr className="border-b border-lumi-line last:border-b-0" key={item.id}>
              <td className="max-w-[300px] py-4 pr-4">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 truncate text-lumi-muted">{item.bodyPreview}</p>
              </td>
              <td className="py-4 pr-4 text-lumi-muted">{item.submittedBy}</td>
              <td className="py-4 pr-4">
                <span className="inline-flex rounded-full bg-lumi-brand-soft px-2.5 py-1 text-xs font-medium text-lumi-brand">
                  {statusLabels[item.status]}
                </span>
              </td>
              <td className="py-4 pr-4 text-lumi-muted">{new Date(item.createdAt).toLocaleString('zh-CN')}</td>
              <td className="py-4 text-right">
                {item.status === 'PENDING' ? (
                  <div className="flex justify-end gap-2">
                    <button
                      className="rounded-md bg-lumi-ink px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                      disabled={updatingId === item.id}
                      onClick={() => void onStatusChange(item.id, 'APPROVED')}
                    >
                      {actionLabels.APPROVED}
                    </button>
                    <button
                      className="rounded-md border border-lumi-line px-3 py-2 text-xs font-medium disabled:opacity-50"
                      disabled={updatingId === item.id}
                      onClick={() => void onStatusChange(item.id, 'REJECTED')}
                    >
                      {actionLabels.REJECTED}
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-lumi-muted">已处理</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
