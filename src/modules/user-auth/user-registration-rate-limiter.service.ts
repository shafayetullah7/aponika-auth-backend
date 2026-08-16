import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { CustomException } from '@/libs/exceptions/custom.exception';
import { ErrorCode } from '@/libs/response/error.schema';
import { InMemoryRateLimiter } from '@/libs/security/in-memory-rate-limiter';

const REGISTER_WINDOW_MS = 15 * 60 * 1000;
const MAX_REGISTER_ATTEMPTS = 5;

@Injectable()
export class UserRegistrationRateLimiterService {
  private readonly limiter = new InMemoryRateLimiter({
    windowMs: REGISTER_WINDOW_MS,
    maxAttempts: MAX_REGISTER_ATTEMPTS,
  });

  constructor(private readonly i18n: I18nService) {}

  assertCanAttempt(key: string, lang: string): void {
    if (this.limiter.assertCanAttempt(key)) {
      return;
    }

    throw new CustomException({
      message: this.i18n.t('message.error.userRegistrationRateLimited', { lang }),
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      errorCode: ErrorCode.TOO_MANY_REQUESTS,
    });
  }

  recordAttempt(key: string): void {
    this.limiter.recordAttempt(key);
  }
}
