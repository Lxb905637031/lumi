import type { ReactNode } from 'react';

type AdminShellProps = {
  title: string;
  children: ReactNode;
  onLogout: () => Promise<void>;
};

export function AdminShell({ title, children, onLogout }: AdminShellProps) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[1160px] px-4 py-7 text-lumi-ink sm:px-8 sm:py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs text-lumi-muted">LUMI / OPERATIONS</span>
          <h1 className="mt-3 text-[28px] font-semibold sm:text-[34px]">{title}</h1>
        </div>
        <button
          className="rounded-md border border-lumi-line px-3 py-2 text-xs font-medium"
          onClick={() => void onLogout()}
        >
          退出登录
        </button>
      </header>
      <div
        className="mt-8 border-l-2 border-lumi-brand bg-lumi-surface px-4 py-3 text-sm text-lumi-muted"
        role="status"
      >
        数据来自服务端；审核操作会记录管理员审计日志。
      </div>
      {children}
    </main>
  );
}
