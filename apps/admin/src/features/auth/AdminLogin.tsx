import { useState } from 'react';
import { loginAdmin } from '../../services/admin-session';

export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      await loginAdmin(username, password);
      onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5">
      <form className="w-full rounded-lg border border-lumi-line bg-lumi-surface p-6 shadow-sm" onSubmit={submit}>
        <span className="text-xs text-lumi-muted">LUMI / OPERATIONS</span>
        <h1 className="mt-3 text-2xl font-semibold">运营后台登录</h1>
        <p className="mt-2 text-sm text-lumi-muted">使用已配置的管理员账号进入审核和运营工作台。</p>
        <label className="mt-7 block text-sm font-medium">
          账号
          <input
            className="mt-2 w-full rounded-md border border-lumi-line bg-white px-3 py-2"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          密码
          <input
            className="mt-2 w-full rounded-md border border-lumi-line bg-white px-3 py-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && (
          <p className="mt-4 border-l-2 border-lumi-brand bg-lumi-brand-soft px-3 py-2 text-sm text-lumi-brand">
            {error}
          </p>
        )}
        <button
          className="mt-6 w-full rounded-md bg-lumi-ink px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          disabled={loading || !username || !password}
        >
          {loading ? '登录中…' : '登录后台'}
        </button>
      </form>
    </main>
  );
}
