import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';

/** Argon2id — passwords, OTP hashes, and client secrets at rest. */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plainText: string): Promise<string> {
  return argon2.hash(plainText, ARGON2_OPTIONS);
}

export async function verifyPassword(
  plainText: string,
  hash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainText);
  } catch {
    return false;
  }
}

export function generateClientSecret(): string {
  return randomBytes(32).toString('base64url');
}
