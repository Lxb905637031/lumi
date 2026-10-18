import { BadRequestException } from '@nestjs/common';

export type TimestampCursor = {
  timestamp: string;
  id: string;
};

export function decodeTimestampCursor(value?: string): TimestampCursor | undefined {
  if (!value) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<TimestampCursor>;
    if (typeof decoded.timestamp !== 'string' || typeof decoded.id !== 'string') throw new Error('invalid cursor');
    const timestamp = new Date(decoded.timestamp);
    if (Number.isNaN(timestamp.valueOf())) throw new Error('invalid date');
    return { timestamp: timestamp.toISOString(), id: decoded.id };
  } catch {
    throw new BadRequestException('分页游标无效');
  }
}

export function encodeTimestampCursor(cursor: TimestampCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}
