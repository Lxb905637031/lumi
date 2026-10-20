import { useCallback, useEffect, useState } from 'react';
import {
  listRuntimeConfigHistory,
  listRuntimeConfigs,
  rollbackRuntimeConfig,
  updateRuntimeConfig,
  type RuntimeConfig,
} from '../../services/moderation-api';

const configLabels: Record<string, string> = {
  'generation.model': '生成模型',
  'quota.free-trial': '免费额度',
  recommendations: '推荐内容',
  'announcements.delivery': '公告投递',
};
const supportedKeys = Object.keys(configLabels);

export function RuntimeConfigPanel() {
  const [items, setItems] = useState<RuntimeConfig[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [history, setHistory] = useState<RuntimeConfig[]>([]);
  const [draft, setDraft] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listRuntimeConfigs();
      setItems(result.items);
      setSelectedKey((current) => current || result.items[0]?.key || supportedKeys[0] || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '配置读取失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshHistory = useCallback(async (key: string) => {
    if (!key) {
      setHistory([]);
      return;
    }
    try {
      const result = await listRuntimeConfigHistory(key);
      setHistory(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '配置历史读取失败');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const current = items.find((item) => item.key === selectedKey);
    setDraft(current ? JSON.stringify(current.value, null, 2) : '{}');
    setReason('');
    void refreshHistory(selectedKey);
  }, [items, selectedKey, refreshHistory]);

  const save = async () => {
    if (!selectedKey) return;
    let value: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(draft);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('配置必须是 JSON 对象');
      value = parsed as Record<string, unknown>;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'JSON 配置格式不正确');
      return;
    }
    if (!reason.trim()) {
      setError('请填写变更原因');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await updateRuntimeConfig(selectedKey, value, reason.trim());
      setNotice(`已保存 ${selectedKey} 的新版本`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '配置保存失败，请刷新后重试');
    } finally {
      setBusy(false);
    }
  };

  const rollback = async (target: RuntimeConfig) => {
    const current = items.find((item) => item.key === selectedKey);
    if (!current || target.id === current.id) return;
    if (!window.confirm(`回滚到 ${selectedKey} v${target.version}？`)) return;
    const rollbackReason = window.prompt('回滚原因', '恢复上一版本配置');
    if (!rollbackReason?.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await rollbackRuntimeConfig({
        key: current.key,
        expectedCurrentId: current.id,
        targetId: target.id,
        reason: rollbackReason.trim(),
      });
      setNotice(`已回滚 ${current.key}`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '回滚失败，请刷新确认当前版本');
    } finally {
      setBusy(false);
    }
  };

  const current = items.find((item) => item.key === selectedKey);

  return (
    <section className="mt-10 border-t border-lumi-line pt-8" aria-labelledby="runtime-config-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-lumi-muted">CONTROL PLANE</p>
          <h2 className="mt-2 text-xl font-semibold" id="runtime-config-title">
            运行配置
          </h2>
          <p className="mt-1 text-sm text-lumi-muted">变更会生成新版本；保存前请确认 JSON、原因和影响范围。</p>
        </div>
        <button
          className="border border-lumi-line px-3 py-2 text-sm"
          disabled={loading || busy}
          onClick={() => void refresh()}
        >
          刷新配置
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
      {loading && !items.length ? <p className="py-8 text-sm text-lumi-muted">正在读取配置…</p> : null}
      {!loading && !items.length ? (
        <p className="py-8 text-sm text-lumi-muted">尚无配置版本，可选择一项并保存首个版本。</p>
      ) : null}
      {(items.length > 0 || supportedKeys.length > 0) && (
        <div className="mt-6 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="divide-y divide-lumi-line border-y border-lumi-line" aria-label="配置项">
            {supportedKeys.map((key) => {
              const item = items.find((entry) => entry.key === key);
              return (
                <button
                  key={key}
                  className={`block w-full px-3 py-3 text-left ${key === selectedKey ? 'border-l-2 border-lumi-brand bg-lumi-brand-soft' : ''}`}
                  onClick={() => setSelectedKey(key)}
                >
                  <span className="block text-sm font-medium">{configLabels[key] ?? key}</span>
                  <span className="mt-1 block text-xs text-lumi-muted">
                    {item ? `v${item.version} · ${item.key}` : '尚未创建'}
                  </span>
                </button>
              );
            })}
          </nav>
          <div>
            {selectedKey && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{configLabels[selectedKey] ?? selectedKey}</h3>
                    <p className="mt-1 text-xs text-lumi-muted">
                      {current
                        ? `当前版本 v${current.version} · ${new Date(current.createdAt).toLocaleString('zh-CN')}`
                        : '尚未创建版本'}
                    </p>
                  </div>
                  <span className="text-xs text-lumi-muted">{current?.actorId ?? '等待首次保存'}</span>
                </div>
                <textarea
                  className="mt-4 min-h-48 w-full border border-lumi-line bg-white px-3 py-3 font-mono text-xs leading-5"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  disabled={busy}
                  aria-label="配置 JSON"
                />
                <input
                  className="mt-3 w-full border border-lumi-line bg-white px-3 py-2.5 text-sm"
                  placeholder="变更原因"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={240}
                  disabled={busy}
                  aria-label="变更原因"
                />
                <button
                  className="mt-3 bg-lumi-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  保存新版本
                </button>
                <div className="mt-8 border-t border-lumi-line pt-5">
                  <h4 className="font-medium">版本历史</h4>
                  <div className="mt-3 divide-y divide-lumi-line">
                    {history.length ? (
                      history.map((version) => (
                        <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={version.id}>
                          <div>
                            <p className="text-sm">
                              v{version.version} · {version.reason}
                            </p>
                            <p className="mt-1 text-xs text-lumi-muted">
                              {new Date(version.createdAt).toLocaleString('zh-CN')}
                            </p>
                          </div>
                          <button
                            className="border border-lumi-line px-3 py-2 text-xs disabled:opacity-50"
                            disabled={busy || version.id === current?.id}
                            onClick={() => void rollback(version)}
                          >
                            回滚到此版本
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="py-4 text-sm text-lumi-muted">尚无历史版本。</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
