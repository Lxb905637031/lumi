import { spawnSync } from 'node:child_process';

export const baselineName = '20261019090000_baseline';

export function databaseTarget(value, { allowRemote = false } = {}) {
  if (!value) throw new Error('DATABASE_URL is required');
  const url = new URL(value);
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error('Only PostgreSQL is supported');
  if (!allowRemote && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Refusing non-loopback database; use the documented operator procedure');
  }
  const schema = url.searchParams.get('schema') ?? 'public';
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(schema)) throw new Error('Unsupported database schema name');
  return { url, schema };
}

// Never print the connection string or a subprocess diagnostic that could contain its password.
export function prismaCommand(args, databaseUrl, { acceptDiff = false } = {}) {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    timeout: 90_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error || (result.status !== 0 && !(acceptDiff && result.status === 2))) {
    const code = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.match(/\bP\d{4}\b/)?.[0];
    throw new Error(
      `Prisma ${args.slice(0, 2).join(' ')} failed (${code ?? result.error?.code ?? result.status ?? 'unknown'}); credentials suppressed`,
    );
  }
  return result.status;
}
