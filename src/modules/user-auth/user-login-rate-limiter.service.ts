import { HttpStatus, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { CustomException } from '@/libs/exceptions/custom.exception';
import { ErrorCode } from '@/libs/response/error.schema';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;

type AttemptEntry = {
  count: number;
  windowStart: number;
};

@Injectable()
export class UserLoginRateLimiterService {
  private readonly attempts = new Map<string, AttemptEntry>();

  constructor(private readonly i18n: I18nService) {}

  assertCanAttempt(key: string, lang: string): void {
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (!entry || now - entry.windowStart >= LOGIN_WINDOW_MS) {
      return;
    }

    if (entry.count >= MAX_LOGIN_ATTEMPTS) {
      throw new CustomException({
        message: this.i18n.t('message.error.userLoginRateLimited', { lang }),
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        errorCode: ErrorCode.TOO_MANY_REQUESTS,
      });
    }
  }

  recordFailedAttempt(key: string): void {
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (!entry || now - entry.windowStart >= LOGIN_WINDOW_MS) {
      this.attempts.set(key, { count: 1, windowStart: now });
      return;
    }

    entry.count += 1;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}
