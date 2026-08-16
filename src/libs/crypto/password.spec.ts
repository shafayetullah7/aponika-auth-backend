import { hashPassword, verifyPassword } from './password';

describe('password (argon2)', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('Secret123!');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword('Secret123!', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('returns false for invalid hash strings', async () => {
    expect(await verifyPassword('Secret123!', 'not-a-hash')).toBe(false);
  });
});
