import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import type { CursorPage, QuotaLedgerEntry, QuotaSummary } from '@lumi/contracts';
import { PrismaService } from '../prisma/prisma.service';
import type { CursorPaginationDto } from '../common/pagination/pagination.dto';
import { decodeTimestampCursor, encodeTimestampCursor } from '../common/pagination/pagination';

type QuotaJob = { id: string; userId: string; quotaAttempt: number };

@Injectable()
export class QuotaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async ensureAccount(tx: Prisma.TransactionClient, userId: string) {
    // Serialize quota initialization without blocking FK KEY SHARE checks from workers.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR NO KEY UPDATE`;
    const existing = await tx.quotaAccount.findUnique({ where: { userId } });
    if (existing) return existing;
    const granted = this.config.getOrThrow<number>('FREE_TRIAL_CREDITS');
    const account = await tx.quotaAccount.create({ data: { userId, granted, available: granted } });
    await tx.quotaLedger.create({
      data: {
        userId,
        eventKey: `${userId}:free-trial-v1:grant`,
        type: 'GRANT',
        deltaAvailable: granted,
        deltaReserved: 0,
        deltaConsumed: 0,
      },
    });
    return account;
  }

  async summary(userId: string): Promise<QuotaSummary> {
    const account = await this.prisma.$transaction((tx) => this.ensureAccount(tx, userId));
    return {
      available: account.available,
      reserved: account.reserved,
      consumed: account.consumed,
      granted: account.granted,
      policyVersion: account.policyVersion,
      costPerGeneration: 1,
    };
  }

  async ledger(userId: string, pagination: CursorPaginationDto): Promise<CursorPage<QuotaLedgerEntry>> {
    const cursor = decodeTimestampCursor(pagination.cursor);
    const rows = await this.prisma.quotaLedger.findMany({
      where: {
        userId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.timestamp) } },
                { createdAt: new Date(cursor.timestamp), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pagination.limit + 1,
    });
    const items = rows.slice(0, pagination.limit);
    const last = items.at(-1);
    return {
      items: items.map((row) => ({
        id: row.id,
        type: row.type,
        jobId: row.jobId,
        attempt: row.attempt,
        deltaAvailable: row.deltaAvailable,
        deltaReserved: row.deltaReserved,
        deltaConsumed: row.deltaConsumed,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor:
        rows.length > pagination.limit && last
          ? encodeTimestampCursor({ timestamp: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }

  async reserve(tx: Prisma.TransactionClient, job: QuotaJob) {
    await this.ensureAccount(tx, job.userId);
    const existing = await tx.quotaReservation.findUnique({
      where: { jobId_attempt: { jobId: job.id, attempt: job.quotaAttempt } },
    });
    if (existing) {
      if (existing.status !== 'RESERVED') throw new ConflictException('该次任务额度已结算');
      return;
    }
    const debited = await tx.quotaAccount.updateMany({
      where: { userId: job.userId, available: { gte: 1 } },
      data: { available: { decrement: 1 }, reserved: { increment: 1 } },
    });
    if (debited.count !== 1)
      throw new ConflictException({ code: 'FREE_QUOTA_EXHAUSTED', message: '免费体验额度不足，未创建生成任务' });
    await tx.quotaReservation.create({ data: { jobId: job.id, userId: job.userId, attempt: job.quotaAttempt } });
    await this.event(tx, job, 'RESERVE', -1, 1, 0);
  }

  async consume(tx: Prisma.TransactionClient, job: QuotaJob) {
    if (job.quotaAttempt === 0) return; // Legacy tasks have no fabricated or retroactive charge.
    const hold = await tx.quotaReservation.updateMany({
      where: { jobId: job.id, attempt: job.quotaAttempt, status: 'RESERVED' },
      data: { status: 'CONSUMED' },
    });
    if (hold.count !== 1) {
      const existing = await tx.quotaReservation.findUnique({
        where: { jobId_attempt: { jobId: job.id, attempt: job.quotaAttempt } },
      });
      if (existing?.status === 'CONSUMED') return;
      throw new ConflictException('任务没有有效的预留额度');
    }
    await tx.quotaAccount.update({
      where: { userId: job.userId },
      data: { reserved: { decrement: 1 }, consumed: { increment: 1 } },
    });
    await this.event(tx, job, 'COMMIT', 0, -1, 1);
  }

  async release(tx: Prisma.TransactionClient, job: QuotaJob) {
    if (job.quotaAttempt === 0) return;
    const hold = await tx.quotaReservation.updateMany({
      where: { jobId: job.id, attempt: job.quotaAttempt, status: 'RESERVED' },
      data: { status: 'RELEASED' },
    });
    if (hold.count !== 1) return;
    await tx.quotaAccount.update({
      where: { userId: job.userId },
      data: { reserved: { decrement: 1 }, available: { increment: 1 } },
    });
    await this.event(tx, job, 'RELEASE', 1, -1, 0);
  }

  private event(
    tx: Prisma.TransactionClient,
    job: QuotaJob,
    type: 'RESERVE' | 'COMMIT' | 'RELEASE',
    deltaAvailable: number,
    deltaReserved: number,
    deltaConsumed: number,
  ) {
    return tx.quotaLedger.create({
      data: {
        userId: job.userId,
        jobId: job.id,
        attempt: job.quotaAttempt,
        eventKey: `${job.id}:${job.quotaAttempt}:${type}`,
        type,
        deltaAvailable,
        deltaReserved,
        deltaConsumed,
      },
    });
  }
}
