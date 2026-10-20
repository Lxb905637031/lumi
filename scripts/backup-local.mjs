import { mkdir, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

if (process.env.NODE_ENV === 'production') throw new Error('backup-local.mjs 仅允许本地开发环境使用');
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const target = resolve(process.argv[2] ?? `output/backups/lumi-${new Date().toISOString().replaceAll(':', '-')}.dump`);
await mkdir(dirname(target), { recursive: true });

const database = new URL(databaseUrl);
const pgDumpArgs = ['--format=custom', '--no-owner', '--no-privileges', '--file', target, databaseUrl];
let child = spawn('pg_dump', pgDumpArgs, { stdio: ['ignore', 'inherit', 'inherit'] });
try {
  await new Promise((resolvePromise, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolvePromise() : reject(new Error(`pg_dump exited with ${code}`))));
  });
} catch (error) {
  if (error?.code !== 'ENOENT' || !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)) throw error;
  child = spawn(
    'docker',
    [
      'exec',
      'lumi-postgres-1',
      'pg_dump',
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      '-U',
      decodeURIComponent(database.username),
      '-d',
      database.pathname.slice(1),
    ],
    {
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
  await Promise.all([
    pipeline(child.stdout, createWriteStream(target)),
    new Promise((resolvePromise, reject) => {
      child.once('error', reject);
      child.once('exit', (code) =>
        code === 0 ? resolvePromise() : reject(new Error(`container pg_dump exited with ${code}`)),
      );
    }),
  ]).catch(async (pipelineError) => {
    await rm(target, { force: true });
    throw pipelineError;
  });
}
const file = await stat(target);
if (file.size < 128) throw new Error('backup file is unexpectedly small');
console.log(
  JSON.stringify({
    target,
    bytes: file.size,
    mode: 'local-only; verify and copy to protected storage before production use',
  }),
);
