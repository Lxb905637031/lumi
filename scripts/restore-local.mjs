import { stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

if (process.env.NODE_ENV === 'production') throw new Error('restore-local.mjs 禁止在生产环境使用');
if (process.env.LUMI_ALLOW_DESTRUCTIVE_RESTORE !== 'YES') {
  throw new Error('恢复会覆盖数据库；设置 LUMI_ALLOW_DESTRUCTIVE_RESTORE=YES 后重新执行');
}
const databaseUrl = process.env.DATABASE_URL;
const target = process.argv[2] && resolve(process.argv[2]);
if (!databaseUrl || !target) throw new Error('DATABASE_URL and an explicit backup path are required');
const file = await stat(target);
if (!file.isFile() || file.size < 128) throw new Error('backup path is not a valid dump file');

await new Promise((resolvePromise, reject) => {
  const child = spawn(
    'pg_restore',
    ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--dbname', databaseUrl, target],
    {
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );
  child.once('error', reject);
  child.once('exit', (code) => (code === 0 ? resolvePromise() : reject(new Error(`pg_restore exited with ${code}`))));
});
console.log(JSON.stringify({ target, mode: 'local-only; run migrations and smoke tests after restore' }));
