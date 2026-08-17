import {
  generateEmailVerificationToken,
  hashEmailVerificationToken,
} from '../../email-verification-token';

describe('email-verification-token', () => {
  it('generates unique tokens', () => {
    const first = generateEmailVerificationToken();
    const second = generateEmailVerificationToken();

    expect(first).not.toEqual(second);
    expect(first.length).toBeGreaterThan(20);
  });

  it('hashes tokens deterministically', () => {
    const token = 'sample-token';
    const first = hashEmailVerificationToken(token);
    const second = hashEmailVerificationToken(token);

    expect(first).toEqual(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });
});
