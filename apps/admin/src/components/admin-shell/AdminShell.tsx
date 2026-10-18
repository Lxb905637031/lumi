import type { ReactNode } from 'react';

type AdminShellProps = {
  title: string;
  children: ReactNode;
};

export function AdminShell({ title, children }: AdminShellProps) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[1160px] px-4 py-7 text-lumi-ink sm:px-8 sm:py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs text-lumi-muted">LUMI / OPERATIONS</span>
          <h1 className="mt-3 text-[28px] font-semibold sm:text-[34px]">{title}</h1>
        </div>
        <span className="rounded-full bg-lumi-brand-soft px-3 py-2 text-xs font-medium text-lumi-brand">开发环境</span>
      </header>
      <div
        className="mt-8 border-l-2 border-lumi-brand bg-lumi-surface px-4 py-3 text-sm text-lumi-muted"
        role="status"
      >
        当前展示本地 fixture 数据，未连接真实审核与运营接口。
      </div>
      {children}
    </main>
  );
}
