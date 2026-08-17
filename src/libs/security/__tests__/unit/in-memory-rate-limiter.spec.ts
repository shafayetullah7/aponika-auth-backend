import { InMemoryRateLimiter } from '../../in-memory-rate-limiter';

describe('InMemoryRateLimiter', () => {
  it('allows attempts within the window limit', () => {
    const limiter = new InMemoryRateLimiter({
      windowMs: 60_000,
      maxAttempts: 3,
    });

    expect(limiter.assertCanAttempt('ip-1')).toBe(true);
    limiter.recordAttempt('ip-1');
    limiter.recordAttempt('ip-1');
    expect(limiter.assertCanAttempt('ip-1')).toBe(true);
    limiter.recordAttempt('ip-1');
    expect(limiter.assertCanAttempt('ip-1')).toBe(false);
  });
});
