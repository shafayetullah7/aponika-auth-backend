import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plainText: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

export function generateClientSecret(): string {
  return randomBytes(32).toString('base64url');
}
