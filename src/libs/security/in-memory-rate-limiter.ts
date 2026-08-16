export type RateLimitWindow = {
  count: number;
  windowStart: number;
};

export type InMemoryRateLimiterOptions = {
  windowMs: number;
  maxAttempts: number;
};

export class InMemoryRateLimiter {
  private readonly attempts = new Map<string, RateLimitWindow>();

  constructor(private readonly options: InMemoryRateLimiterOptions) {}

  assertCanAttempt(key: string): boolean {
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (!entry || now - entry.windowStart >= this.options.windowMs) {
      return true;
    }

    return entry.count < this.options.maxAttempts;
  }

  recordAttempt(key: string): void {
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (!entry || now - entry.windowStart >= this.options.windowMs) {
      this.attempts.set(key, { count: 1, windowStart: now });
      return;
    }

    entry.count += 1;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}
