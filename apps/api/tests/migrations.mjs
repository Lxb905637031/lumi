import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { adoptBaseline } from '../scripts/adopt-baseline.mjs';
import { baselineName, databaseTarget, prismaCommand } from '../scripts/migration-tools.mjs';

assert.notEqual(process.env.NODE_ENV, 'production', 'Migration fixtures cannot run in production');
const { url } = databaseTarget(process.env.DATABASE_URL);
const admin = new PrismaClient({ datasourceUrl: url.toString() });
const schemas = [];
const clients = [];
const passed = [];

async function isolatedDatabase() {
  const schema = 'lumi_migration_test_' + randomUUID().replaceAll('-', '');
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  schemas.push(schema);
  const target = new URL(url);
  target.searchParams.set('schema', schema);
  const databaseUrl = target.toString();
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  clients.push(client);
  return { schema, databaseUrl, client };
}

try {
  const empty = await isolatedDatabase();
  prismaCommand(['migrate', 'deploy', '--schema', 'prisma/schema.prisma'], empty.databaseUrl);
  prismaCommand(['migrate', 'deploy', '--schema', 'prisma/schema.prisma'], empty.databaseUrl);
  assert.equal(
    prismaCommand(
      [
        'migrate',
        'diff',
        '--from-url',
        empty.databaseUrl,
        '--to-schema-datamodel',
        'prisma/schema.prisma',
        '--exit-code',
      ],
      empty.databaseUrl,
      { acceptDiff: true },
    ),
    0,
  );
  passed.push('empty schema deploy, repeated deploy, and exact current-schema match');

  const legacy = await isolatedDatabase();
  prismaCommand(['db', 'push', '--schema', 'prisma/baseline/schema.prisma', '--skip-generate'], legacy.databaseUrl);
  // Raw insert deliberately uses only baseline columns, so later migrations can change the generated client.
  const id = randomUUID();
  await legacy.client.$executeRawUnsafe(
    `INSERT INTO "${legacy.schema}"."users" (id, wx_open_id, updated_at) VALUES ($1, $2, NOW())`,
    id,
    'migration-sentinel:' + id,
  );
  const profileId = randomUUID();
  const assetId = randomUUID();
  await legacy.client.$executeRawUnsafe(
    `INSERT INTO "${legacy.schema}"."media_assets" (id, owner_id, object_key, mime_type, byte_size, sha256, preview_data) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    assetId,
    id,
    'local/legacy-sentinel',
    'image/png',
    1,
    'legacy-hash',
    'legacy-preview',
  );
  await legacy.client.$executeRawUnsafe(
    `INSERT INTO "${legacy.schema}"."body_profiles" (id, user_id, name, updated_at) VALUES ($1, $2, $3, NOW())`,
    profileId,
    id,
    'preserved profile',
  );
  const versionId = randomUUID();
  const clothingId = randomUUID();
  const jobId = randomUUID();
  await legacy.client.$executeRawUnsafe(
    `INSERT INTO "${legacy.schema}"."body_profile_versions" (id, profile_id, version, measurements) VALUES ($1, $2, 1, '{}'::jsonb)`,
    versionId,
    profileId,
  );
  await legacy.client.$executeRawUnsafe(
    `INSERT INTO "${legacy.schema}"."clothing_items" (id, user_id, name, category, updated_at) VALUES ($1, $2, 'legacy shirt', 'TOP', NOW())`,
    clothingId,
    id,
  );
  await legacy.client.$executeRawUnsafe(
    `INSERT INTO "${legacy.schema}"."generation_jobs" (id, user_id, profile_version_id, clothing_asset_id, idempotency_key, updated_at) VALUES ($1, $2, $3, $4, 'legacy-job', NOW())`,
    jobId,
    id,
    versionId,
    clothingId,
  );
  await legacy.client.$executeRawUnsafe(`ALTER TABLE "${legacy.schema}"."users" ADD COLUMN migration_test_drift TEXT`);
  const outputId = randomUUID();
  await legacy.client.$executeRawUnsafe(
    `INSERT INTO "${legacy.schema}"."generation_outputs" (id, job_id, asset_id, selected_at) VALUES ($1, $2, $3, NOW())`,
    outputId,
    jobId,
    assetId,
  );
  await assert.rejects(() => adoptBaseline(legacy.databaseUrl), /Schema drift detected/);
  const [history] = await legacy.client.$queryRawUnsafe(
    'SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2) AS exists',
    legacy.schema,
    '_prisma_migrations',
  );
  assert.equal(history.exists, false, 'Rejected adoption must not write history');
  await legacy.client.$executeRawUnsafe(`ALTER TABLE "${legacy.schema}"."users" DROP COLUMN migration_test_drift`);
  assert.equal((await adoptBaseline(legacy.databaseUrl)).adopted, true);
  assert.equal((await adoptBaseline(legacy.databaseUrl)).adopted, false);
  prismaCommand(['migrate', 'deploy', '--schema', 'prisma/schema.prisma'], legacy.databaseUrl);
  const profile = await legacy.client.bodyProfile.findUniqueOrThrow({ where: { id: profileId } });
  assert.equal(profile.name, 'preserved profile');
  assert.equal(profile.userId, id);
  const asset = await legacy.client.mediaAsset.findUniqueOrThrow({ where: { id: assetId } });
  assert.equal(asset.status, 'READY');
  assert.equal(asset.storageDriver, 'local');
  assert.equal(asset.previewData, 'legacy-preview');
  const job = await legacy.client.generationJob.findUniqueOrThrow({ where: { id: jobId } });
  assert.equal(job.quotaAttempt, 0);
  assert.equal(job.inputSnapshot, null);
  assert.equal(job.executionToken, null);
  const output = await legacy.client.generationOutput.findUniqueOrThrow({ where: { id: outputId } });
  assert.ok(output.selectedAt, 'Migration retains the legacy selection');
  assert.equal(output.savedAt, null);
  assert.equal(output.deletedAt, null);
  assert.equal(await legacy.client.quotaAccount.count(), 0, 'Upgrades must not fabricate grants or historical charges');
  const migrations = await legacy.client.$queryRawUnsafe(
    `SELECT migration_name FROM "${legacy.schema}"."_prisma_migrations" WHERE finished_at IS NOT NULL`,
  );
  assert.ok(migrations.some((entry) => entry.migration_name === baselineName));
  assert.equal(
    prismaCommand(
      [
        'migrate',
        'diff',
        '--from-url',
        legacy.databaseUrl,
        '--to-schema-datamodel',
        'prisma/schema.prisma',
        '--exit-code',
      ],
      legacy.databaseUrl,
      { acceptDiff: true },
    ),
    0,
  );
  passed.push('legacy sentinel data preserved through drift rejection, baseline adoption and upgrade');
  assert.throws(() => databaseTarget('postgresql://user:secret@production.example/lumi'), /non-loopback/);
  await assert.rejects(
    () => adoptBaseline('postgresql://user:secret@production.example/lumi', { allowRemote: true }),
    /verified backup/,
  );
  passed.push('remote mutation guard');
  console.log(JSON.stringify({ passed, fixtureSchemas: schemas.length }, null, 2));
} finally {
  await Promise.all(clients.map((client) => client.$disconnect()));
  for (const schema of schemas) {
    // Never drop public or any schema supplied by environment/user input.
    assert.match(schema, /^lumi_migration_test_[a-f0-9]{32}$/);
    await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  }
  await admin.$disconnect();
}
