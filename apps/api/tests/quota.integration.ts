import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Job } from 'bullmq';
import { PrismaService } from '../src/prisma/prisma.service';
import { QuotaService } from '../src/quota/quota.service';
import { GenerationsService } from '../src/generations/generations.service';
import { GenerationProcessor } from '../src/generations/generation.processor';
import { GenerationRecoveryService } from '../src/generations/generation-recovery.service';
import {
  GENERATION_QUEUE,
  type EnqueueGenerationCommand,
  type GenerationQueue,
} from '../src/generations/generation-queue.port';
import { GENERATION_PROVIDER, type GenerationProvider } from '../src/generations/generation-provider.port';
import { LocalGenerationProvider } from '../src/generations/local-generation-provider';

test('quota and generation lifecycle against isolated real PostgreSQL', async (t) => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Local database only');
  const schema = 'lumi_quota_test_' + randomUUID().replaceAll('-', '');
  const admin = new PrismaService({ datasourceUrl: url.toString() });
  const target = new URL(url);
  target.searchParams.set('schema', schema);
  const db = new PrismaService({ datasourceUrl: target.toString() });
  const commands: EnqueueGenerationCommand[] = [];
  let queueFails = false;
  let executeOnEnqueue = false;
  const queue: GenerationQueue = {
    enqueue: async (command) => {
      if (queueFails) throw new Error('fixture queue offline');
      commands.push(command);
      if (executeOnEnqueue) await run(command.jobId);
    },
    retry: async (command) => {
      commands.push(command);
    },
    cancel: async () => {
      if (queueFails) throw new Error('fixture queue offline');
    },
  };
  const config = new ConfigService({
    FREE_MODE: 'true',
    FREE_TRIAL_CREDITS: 5,
    GENERATION_QUEUE_ATTEMPTS: 3,
    GENERATION_QUEUE_BACKOFF_MS: 100,
  });
  const provider = new LocalGenerationProvider();
  let generate: GenerationProvider['generate'] = (command) => provider.generate(command);
  const moduleRef = await Test.createTestingModule({
    providers: [
      QuotaService,
      GenerationsService,
      GenerationProcessor,
      GenerationRecoveryService,
      { provide: PrismaService, useValue: db },
      { provide: ConfigService, useValue: config },
      { provide: GENERATION_QUEUE, useValue: queue },
      {
        provide: GENERATION_PROVIDER,
        useValue: { generate: (command: Parameters<GenerationProvider['generate']>[0]) => generate(command) },
      },
    ],
  }).compile();
  const quota = moduleRef.get(QuotaService);
  const generations = moduleRef.get(GenerationsService);
  const processor = moduleRef.get(GenerationProcessor);
  const recovery = moduleRef.get(GenerationRecoveryService);
  async function fixture() {
    const user = await db.user.create({ data: { wxOpenId: 'quota-fixture:' + randomUUID() } });
    const profile = await db.bodyProfile.create({
      data: {
        userId: user.id,
        name: 'Original profile',
        versions: { create: { version: 1, measurements: { heightCm: 170 } } },
      },
      include: { versions: true },
    });
    const clothing = await db.clothingItem.create({
      data: { userId: user.id, name: 'Original shirt', category: 'TOP' },
    });
    return {
      userId: user.id,
      input: { profileVersionId: profile.versions[0]!.id, clothingAssetId: clothing.id, idempotencyKey: randomUUID() },
    };
  }
  async function run(id: string) {
    const job = await db.generationJob.findUniqueOrThrow({ where: { id } });
    return processor.process({
      data: {
        jobId: id,
        userId: job.userId,
        profileVersionId: job.profileVersionId,
        clothingAssetId: job.clothingAssetId,
        quotaAttempt: job.quotaAttempt,
      },
    } as Job<EnqueueGenerationCommand>);
  }
  async function balances(userId: string, available: number, reserved: number, consumed: number) {
    const summary = await quota.summary(userId);
    assert.deepEqual([summary.available, summary.reserved, summary.consumed], [available, reserved, consumed]);
    const ledger = await db.quotaLedger.aggregate({
      where: { userId },
      _sum: { deltaAvailable: true, deltaReserved: true, deltaConsumed: true },
    });
    assert.deepEqual(
      [ledger._sum.deltaAvailable, ledger._sum.deltaReserved, ledger._sum.deltaConsumed],
      [available, reserved, consumed],
    );
  }
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const deploy = spawnSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
      { env: { ...process.env, DATABASE_URL: target.toString() }, encoding: 'utf8', timeout: 60_000 },
    );
    assert.equal(deploy.status, 0, 'Fixture migrations must succeed');
    await t.test('single initial grant under parallel reads; database rejects impossible balances', async () => {
      const f = await fixture();
      await Promise.all(Array.from({ length: 12 }, () => quota.summary(f.userId)));
      await balances(f.userId, 5, 0, 0);
      assert.equal(await db.quotaLedger.count({ where: { userId: f.userId, type: 'GRANT' } }), 1);
      await assert.rejects(() => db.quotaAccount.update({ where: { userId: f.userId }, data: { available: -1 } }));
      await assert.rejects(() => db.quotaAccount.update({ where: { userId: f.userId }, data: { available: 6 } }));
      await balances(f.userId, 5, 0, 0);
    });
    await t.test(
      'same-key concurrent creation reserves once; different inputs conflict; snapshots stay immutable',
      async () => {
        const f = await fixture();
        const jobs = await Promise.all(Array.from({ length: 8 }, () => generations.create(f.userId, f.input)));
        assert.equal(new Set(jobs.map((j) => j.id)).size, 1);
        await balances(f.userId, 4, 1, 0);
        const other = await db.clothingItem.create({
          data: { userId: f.userId, name: 'Other shirt', category: 'TOP' },
        });
        await assert.rejects(() => generations.create(f.userId, { ...f.input, clothingAssetId: other.id }), /幂等键/);
        await db.clothingItem.update({ where: { id: f.input.clothingAssetId }, data: { name: 'Edited shirt' } });
        const saved = await db.generationJob.findUniqueOrThrow({ where: { id: jobs[0]!.id } });
        assert.equal((saved.inputSnapshot as { clothing: { name: string } }).clothing.name, 'Original shirt');
        await Promise.all([run(saved.id), run(saved.id)]);
        await run(saved.id);
        await balances(f.userId, 4, 0, 1);
        assert.equal(await db.generationOutput.count({ where: { jobId: saved.id } }), 1);
        assert.equal(await db.notification.count({ where: { targetId: saved.id } }), 1);
        assert.equal(await db.quotaLedger.count({ where: { jobId: saved.id, type: 'COMMIT' } }), 1);
      },
    );
    await t.test(
      'parallel distinct submissions cannot overspend; cancellations refund exactly once even without Redis',
      async () => {
        const f = await fixture();
        const results = await Promise.allSettled(
          Array.from({ length: 9 }, () => generations.create(f.userId, { ...f.input, idempotencyKey: randomUUID() })),
        );
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 5);
        for (const result of results)
          if (result.status === 'rejected') assert.match(String(result.reason), /免费体验额度不足/);
        await balances(f.userId, 0, 5, 0);
        const jobs = await db.generationJob.findMany({ where: { userId: f.userId } });
        queueFails = true;
        await Promise.all(
          jobs.flatMap((j) => [generations.cancel(f.userId, j.id), generations.cancel(f.userId, j.id)]),
        );
        queueFails = false;
        await balances(f.userId, 5, 0, 0);
        assert.equal(await db.quotaLedger.count({ where: { userId: f.userId, type: 'RELEASE' } }), 5);
      },
    );
    await t.test(
      'automatic retries retain a hold; final failure refunds; concurrent manual retry creates one new hold',
      async () => {
        const f = await fixture();
        const job = await generations.create(f.userId, f.input);
        generate = async () => {
          throw new Error('fixture provider offline');
        };
        for (let i = 0; i < 3; i += 1) {
          await db.generationJob.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(0) } });
          await assert.rejects(() => run(job.id), /fixture provider offline/);
          await balances(f.userId, i === 2 ? 5 : 4, i === 2 ? 0 : 1, 0);
        }
        assert.equal((await db.generationJob.findUniqueOrThrow({ where: { id: job.id } })).status, 'DEAD_LETTER');
        await Promise.all(Array.from({ length: 6 }, () => generations.retry(f.userId, job.id)));
        await balances(f.userId, 4, 1, 0);
        assert.equal((await db.generationJob.findUniqueOrThrow({ where: { id: job.id } })).quotaAttempt, 2);
        // Stale queue delivery from attempt 1 cannot claim the new attempt.
        const stale = commands.find((c) => c.jobId === job.id && c.quotaAttempt === 1)!;
        await processor.process({ data: stale } as Job<EnqueueGenerationCommand>);
        assert.equal((await db.generationJob.findUniqueOrThrow({ where: { id: job.id } })).status, 'QUEUED');
        generate = (command) => provider.generate(command);
        await run(job.id);
        await balances(f.userId, 4, 0, 1);
        assert.equal(await db.quotaReservation.count({ where: { jobId: job.id } }), 2);
      },
    );
    await t.test('parallel submitters and executing workers do not deadlock on user foreign keys', async () => {
      executeOnEnqueue = true;
      try {
        for (let round = 0; round < 8; round += 1) {
          const f = await fixture();
          const results = await Promise.allSettled(
            Array.from({ length: 9 }, () => generations.create(f.userId, { ...f.input, idempotencyKey: randomUUID() })),
          );
          assert.equal(results.filter((r) => r.status === 'fulfilled').length, 5);
          for (const result of results)
            if (result.status === 'rejected') assert.match(String(result.reason), /免费体验额度不足/);
          await balances(f.userId, 0, 0, 5);
          assert.equal(await db.notification.count({ where: { userId: f.userId } }), 5);
        }
      } finally {
        executeOnEnqueue = false;
      }
    });
    await t.test('queue failure rolls back hold; repeated key does not double refund', async () => {
      const f = await fixture();
      queueFails = true;
      await assert.rejects(() => generations.create(f.userId, f.input), /预留额度已释放/);
      queueFails = false;
      await balances(f.userId, 5, 0, 0);
      const same = await generations.create(f.userId, f.input);
      assert.equal(same.status, 'FAILED');
      assert.equal(await db.quotaLedger.count({ where: { jobId: same.id, type: 'RELEASE' } }), 1);
      await generations.retry(f.userId, same.id);
      await run(same.id);
      await balances(f.userId, 4, 0, 1);
    });
    await t.test('durable queued rows redispatch after interruption; recovery failure retains the hold', async () => {
      const f = await fixture();
      const job = await generations.create(f.userId, f.input);
      commands.length = 0;
      queueFails = true;
      await recovery.sweep();
      await balances(f.userId, 4, 1, 0);
      queueFails = false;
      await recovery.sweep();
      assert.ok(commands.some((c) => c.jobId === job.id));
      await run(job.id);
      await balances(f.userId, 4, 0, 1);
    });
    await t.test('expired worker refunds once and cannot write output after manual retry', async () => {
      const f = await fixture();
      const job = await generations.create(f.userId, f.input);
      let unblock!: () => void;
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const wait = new Promise<void>((resolve) => {
        unblock = resolve;
      });
      generate = async (command) => {
        entered();
        await wait;
        return provider.generate(command);
      };
      const oldWorker = run(job.id);
      await started;
      await db.generationJob.update({ where: { id: job.id }, data: { leaseExpiresAt: new Date(0) } });
      await Promise.all([recovery.sweep(), recovery.sweep()]);
      await balances(f.userId, 5, 0, 0);
      await generations.retry(f.userId, job.id);
      unblock();
      await oldWorker;
      assert.equal((await db.generationJob.findUniqueOrThrow({ where: { id: job.id } })).status, 'QUEUED');
      assert.equal(await db.generationOutput.count({ where: { jobId: job.id } }), 0);
      generate = (command) => provider.generate(command);
      await run(job.id);
      await balances(f.userId, 4, 0, 1);
      assert.equal(await db.notification.count({ where: { targetId: job.id, title: '试穿任务已中断' } }), 1);
    });
    await t.test('legacy jobs stay unmetered and snapshot-free', async () => {
      const f = await fixture();
      const job = await db.generationJob.create({ data: { userId: f.userId, ...f.input, provider: 'local-svg' } });
      assert.equal(job.quotaAttempt, 0);
      assert.equal(job.inputSnapshot, null);
      await run(job.id);
      assert.equal(await db.quotaAccount.count({ where: { userId: f.userId } }), 0);
      assert.equal(await db.quotaLedger.count({ where: { userId: f.userId } }), 0);
    });
    await t.test(
      'long-unavailable dispatch refunds automatically and cannot leave a permanent reservation',
      async () => {
        const f = await fixture();
        const job = await generations.create(f.userId, f.input);
        await db.generationJob.update({ where: { id: job.id }, data: { updatedAt: new Date(Date.now() - 360_000) } });
        queueFails = true;
        await recovery.sweep();
        await recovery.sweep();
        queueFails = false;
        assert.equal(
          (await db.generationJob.findUniqueOrThrow({ where: { id: job.id } })).errorCode,
          'QUEUE_DISPATCH_EXPIRED',
        );
        await balances(f.userId, 5, 0, 0);
        assert.equal(await db.quotaLedger.count({ where: { jobId: job.id, type: 'RELEASE' } }), 1);
      },
    );
    await t.test('cancelling an active worker fences its later output and returns the hold', async () => {
      const f = await fixture();
      const job = await generations.create(f.userId, f.input);
      let unblock!: () => void;
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const wait = new Promise<void>((resolve) => {
        unblock = resolve;
      });
      generate = async (command) => {
        entered();
        await wait;
        return provider.generate(command);
      };
      const active = run(job.id);
      await started;
      await generations.cancel(f.userId, job.id);
      unblock();
      await active;
      generate = (command) => provider.generate(command);
      assert.equal(await db.generationOutput.count({ where: { jobId: job.id } }), 0);
      assert.equal(await db.notification.count({ where: { targetId: job.id } }), 0);
      await balances(f.userId, 5, 0, 0);
    });
  } finally {
    await moduleRef.close();
    await db.$disconnect();
    // Only the exact generated fixture schema is dropped, never a supplied/public schema.
    assert.match(schema, /^lumi_quota_test_[a-f0-9]{32}$/);
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  }
});
