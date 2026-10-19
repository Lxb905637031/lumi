import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { baselineName, databaseTarget, prismaCommand } from './migration-tools.mjs';

export async function adoptBaseline(databaseUrl, { allowRemote = false } = {}) {
  const { schema } = databaseTarget(databaseUrl, { allowRemote });
  if (allowRemote && process.env.LUMI_BASELINE_BACKUP_CONFIRMED !== 'true') {
    throw new Error('Remote baseline adoption requires LUMI_BASELINE_BACKUP_CONFIRMED=true after a verified backup');
  }
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const [{ exists }] = await prisma.$queryRawUnsafe(
      'SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2) AS exists',
      schema,
      '_prisma_migrations',
    );
    if (exists) {
      const history = await prisma.$queryRawUnsafe(
        `SELECT migration_name, checksum, finished_at, rolled_back_at FROM "${schema}"."_prisma_migrations"`,
      );
      const known = new Set(
        (await readdir('prisma/migrations', { withFileTypes: true }))
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name),
      );
      if (history.some((entry) => !known.has(entry.migration_name) || !entry.finished_at || entry.rolled_back_at)) {
        throw new Error('Unknown or incomplete migration history; baseline adoption refused');
      }
      const baseline = history.find((entry) => entry.migration_name === baselineName);
      if (baseline) {
        const checksum = createHash('sha256')
          .update(await readFile(`prisma/migrations/${baselineName}/migration.sql`))
          .digest('hex');
        if (baseline.checksum !== checksum)
          throw new Error('Baseline checksum mismatch; do not edit applied migrations');
        return { adopted: false, reason: 'Baseline already tracked' };
      }
      if (history.length) throw new Error('Nonempty history without the expected baseline; adoption refused');
    }
    const diff = prismaCommand(
      [
        'migrate',
        'diff',
        '--from-url',
        databaseUrl,
        '--to-schema-datamodel',
        'prisma/baseline/schema.prisma',
        '--exit-code',
      ],
      databaseUrl,
      { acceptDiff: true },
    );
    if (diff === 2)
      throw new Error(
        'Schema drift detected; no migration history was written. Review and reconcile without data loss',
      );
    prismaCommand(['migrate', 'resolve', '--applied', baselineName, '--schema', 'prisma/schema.prisma'], databaseUrl);
    return { adopted: true, reason: 'Existing schema exactly matches the immutable baseline' };
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const unknown = process.argv.slice(2).filter((arg) => arg !== '--allow-remote-baseline');
    if (unknown.length) throw new Error('Unsupported baseline adoption arguments');
    console.log(
      await adoptBaseline(process.env.DATABASE_URL, { allowRemote: process.argv.includes('--allow-remote-baseline') }),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Baseline adoption failed');
    process.exitCode = 1;
  }
}
