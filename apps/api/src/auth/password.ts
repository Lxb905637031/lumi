import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const deriveKey = promisify(scrypt);
const DUMMY_HASH = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await deriveKey(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, encodedHash: string = DUMMY_HASH): Promise<boolean> {
  const validFormat = /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encodedHash);
  const [, salt, encoded] = (validFormat ? encodedHash : DUMMY_HASH).split('$');
  const expected = Buffer.from(encoded!, 'hex');
  const actual = (await deriveKey(password, salt!, 64)) as Buffer;
  return timingSafeEqual(expected, actual) && validFormat;
}
