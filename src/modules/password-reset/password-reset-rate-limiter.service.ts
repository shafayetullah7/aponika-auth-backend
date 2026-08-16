import { HttpStatus, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { CustomException } from '@/libs/exceptions/custom.exception';
import { ErrorCode } from '@/libs/response/error.schema';

const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const OTP_COOLDOWN_MS = 60_000;

type AttemptEntry = {
  count: number;
  windowStart: number;
  lastOtpSentAt?: number;
};

@Injectable()
export class PasswordResetRateLimiterService {
  private readonly requestAttempts = new Map<string, AttemptEntry>();

  constructor(private readonly i18n: I18nService) {}

  assertCanRequest(key: string, lang: string): void {
    const now = Date.now();
    const entry = this.requestAttempts.get(key);

    if (!entry || now - entry.windowStart >= REQUEST_WINDOW_MS) {
      return;
    }

    if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
      throw new CustomException({
        message: this.i18n.t('message.error.passwordResetRateLimited', { lang }),
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        errorCode: ErrorCode.TOO_MANY_REQUESTS,
      });
    }
  }

  assertCanSendOtp(key: string, lang: string): void {
    const entry = this.requestAttempts.get(key);
    if (!entry?.lastOtpSentAt) {
      return;
    }

    const elapsedMs = Date.now() - entry.lastOtpSentAt;
    if (elapsedMs < OTP_COOLDOWN_MS) {
      throw new CustomException({
        message: this.i18n.t('message.error.passwordResetOtpCooldown', { lang }),
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        errorCode: ErrorCode.TOO_MANY_REQUESTS,
      });
    }
  }

  recordRequest(key: string): void {
    const now = Date.now();
    const entry = this.requestAttempts.get(key);

    if (!entry || now - entry.windowStart >= REQUEST_WINDOW_MS) {
      this.requestAttempts.set(key, { count: 1, windowStart: now });
      return;
    }

    entry.count += 1;
  }

  recordOtpSent(key: string): void {
    const now = Date.now();
    const entry = this.requestAttempts.get(key);

    if (!entry || now - entry.windowStart >= REQUEST_WINDOW_MS) {
      this.requestAttempts.set(key, {
        count: 1,
        windowStart: now,
        lastOtpSentAt: now,
      });
      return;
    }

    entry.count += 1;
    entry.lastOtpSentAt = now;
  }
}
