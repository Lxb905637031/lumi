import { BadRequestException } from '@nestjs/common';

export function decodeProfileVersionCursor(value?: string): number | undefined {
  if (!value) return undefined;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('ascii');
    const version = Number(decoded);
    if (!/^\d+$/.test(decoded) || !Number.isSafeInteger(version) || version < 1) throw new Error('invalid cursor');
    return version;
  } catch {
    throw new BadRequestException('分页游标无效');
  }
}

export function encodeProfileVersionCursor(version: number): string {
  return Buffer.from(String(version), 'ascii').toString('base64url');
}
