import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

if (process.env.NODE_ENV === 'production') throw new Error('verify-backup-local.mjs 仅允许本地开发环境使用');

const target = process.argv[2] && resolve(process.argv[2]);
if (!target) throw new Error('an explicit backup path is required');
const file = await stat(target).catch(() => null);
if (!file?.isFile() || file.size < 128) throw new Error('backup path is not a valid dump file');

const hash = createHash('sha256');
await new Promise((resolvePromise, reject) => {
  const input = createReadStream(target);
  input.on('data', (chunk) => hash.update(chunk));
  input.once('error', reject);
  input.once('end', resolvePromise);
});

const runList = (command, args, input) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let errorOutput = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      errorOutput += chunk;
    });
    if (input) {
      const source = createReadStream(target);
      source.once('error', reject);
      source.pipe(child.stdin);
    }
    child.once('error', (error) => reject(Object.assign(error, { stderr: errorOutput })));
    child.once('exit', (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`${command} exited with ${code}: ${errorOutput.trim()}`)),
    );
  });

try {
  await runList('pg_restore', ['--list', target]);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
  await runList('docker', ['exec', '-i', 'lumi-postgres-1', 'pg_restore', '--list', '-'], true);
}

console.log(
  JSON.stringify({
    target,
    bytes: file.size,
    sha256: hash.digest('hex'),
    verified: 'pg_restore --list',
    mode: 'local-only; copy the digest and dump to protected storage before production use',
  }),
);
