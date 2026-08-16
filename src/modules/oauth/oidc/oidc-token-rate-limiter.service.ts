import { HttpStatus, Injectable } from '@nestjs/common';
import { CustomException } from '@/libs/exceptions/custom.exception';
import { ErrorCode } from '@/libs/response/error.schema';
import { InMemoryRateLimiter } from '@/libs/security/in-memory-rate-limiter';

const TOKEN_WINDOW_MS = 15 * 60 * 1000;
const MAX_TOKEN_ATTEMPTS = 60;

@Injectable()
export class OidcTokenRateLimiterService {
  private readonly limiter = new InMemoryRateLimiter({
    windowMs: TOKEN_WINDOW_MS,
    maxAttempts: MAX_TOKEN_ATTEMPTS,
  });

  assertCanAttempt(key: string): void {
    if (this.limiter.assertCanAttempt(key)) {
      return;
    }

    throw new CustomException({
      message: 'Too many token requests. Please try again later.',
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      errorCode: ErrorCode.TOO_MANY_REQUESTS,
    });
  }

  recordAttempt(key: string): void {
    this.limiter.recordAttempt(key);
  }
}
