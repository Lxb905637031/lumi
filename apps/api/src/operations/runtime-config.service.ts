import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const CONFIG_KEY = /^[a-z][a-z0-9._-]{1,79}$/;

@Injectable()
export class RuntimeConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.runtimeConfig.findMany({ orderBy: [{ configKey: 'asc' }, { version: 'desc' }] });
    const current = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!current.has(row.configKey)) current.set(row.configKey, row);
    return { items: [...current.values()].map((row) => this.toContract(row)) };
  }

  async history(key: string) {
    this.assertKey(key);
    const rows = await this.prisma.runtimeConfig.findMany({ where: { configKey: key }, orderBy: { version: 'desc' } });
    return { items: rows.map((row) => this.toContract(row)) };
  }

  async upsert(actorId: string, key: string, value: Record<string, unknown>, reason: string) {
    this.assertKey(key);
    this.assertValue(key, value);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0)) IS NULL AS locked`;
      const latest = await tx.runtimeConfig.findFirst({ where: { configKey: key }, orderBy: { version: 'desc' } });
      const row = await tx.runtimeConfig.create({
        data: {
          configKey: key,
          version: (latest?.version ?? 0) + 1,
          value: value as Prisma.InputJsonValue,
          reason,
          actorId,
        },
      });
      return this.toContract(row);
    });
  }

  async rollback(actorId: string, input: { key: string; expectedCurrentId: string; targetId: string; reason: string }) {
    this.assertKey(input.key);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.key}, 0)) IS NULL AS locked`;
      const [current, target] = await Promise.all([
        tx.runtimeConfig.findFirst({ where: { configKey: input.key }, orderBy: { version: 'desc' } }),
        tx.runtimeConfig.findFirst({ where: { id: input.targetId, configKey: input.key } }),
      ]);
      if (!current || current.id !== input.expectedCurrentId)
        throw new ConflictException('配置已被其他管理员更新，请刷新');
      if (!target) throw new NotFoundException('回滚目标配置不存在');
      const row = await tx.runtimeConfig.create({
        data: {
          configKey: input.key,
          version: current.version + 1,
          value: target.value as Prisma.InputJsonValue,
          reason: `回滚至 v${target.version}：${input.reason}`,
          actorId,
        },
      });
      return this.toContract(row);
    });
  }

  private assertKey(key: string) {
    if (!CONFIG_KEY.test(key)) throw new BadRequestException('配置键格式不正确');
    if (!['generation.model', 'quota.free-trial', 'recommendations', 'announcements.delivery'].includes(key)) {
      throw new BadRequestException('不支持的配置键');
    }
  }

  private assertValue(key: string, value: Record<string, unknown>) {
    const valid =
      (key === 'generation.model' &&
        typeof value.enabled === 'boolean' &&
        ['disabled', 'local-svg', 'self-hosted'].includes(String(value.provider)) &&
        typeof value.modelId === 'string' &&
        value.modelId.length <= 120) ||
      (key === 'quota.free-trial' &&
        Number.isInteger(value.granted) &&
        Number(value.granted) >= 0 &&
        Number(value.granted) <= 1000) ||
      (key === 'recommendations' &&
        typeof value.enabled === 'boolean' &&
        Array.isArray(value.pinnedPostIds) &&
        value.pinnedPostIds.length <= 20 &&
        value.pinnedPostIds.every((id) => typeof id === 'string' && id.length <= 128)) ||
      (key === 'announcements.delivery' &&
        Number.isInteger(value.batchSize) &&
        Number(value.batchSize) >= 1 &&
        Number(value.batchSize) <= 100 &&
        typeof value.enabled === 'boolean');
    if (!valid) throw new BadRequestException('配置值不符合该配置项的约束');
  }

  private toContract(row: {
    id: string;
    configKey: string;
    version: number;
    value: Prisma.JsonValue;
    reason: string;
    actorId: string;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      key: row.configKey,
      version: row.version,
      value: row.value,
      reason: row.reason,
      actorId: row.actorId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
