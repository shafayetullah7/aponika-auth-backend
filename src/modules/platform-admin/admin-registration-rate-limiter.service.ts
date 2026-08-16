import { HttpStatus, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { DrizzleTx } from '@/_db/drizzle/types';
import { CustomException } from '@/libs/exceptions/custom.exception';
import { ErrorCode } from '@/libs/response/error.schema';
import { AdminRegistrationRateLimitRepository } from './admin-registration-rate-limit.repository';

export const ADMIN_REGISTRATION_OTP_COOLDOWN_MS = 60_000;

@Injectable()
export class AdminRegistrationRateLimiterService {
  constructor(
    private readonly rateLimitRepository: AdminRegistrationRateLimitRepository,
    private readonly i18n: I18nService,
  ) {}

  async assertCanSendOtp(tx: DrizzleTx, lang: string): Promise<void> {
    const lastSentAt =
      await this.rateLimitRepository.getLastOtpSentAtForUpdate(tx);

    if (!lastSentAt) {
      return;
    }

    const elapsedMs = Date.now() - lastSentAt.getTime();
    if (elapsedMs < ADMIN_REGISTRATION_OTP_COOLDOWN_MS) {
      throw new CustomException({
        message: this.i18n.t('message.error.adminRegistrationRateLimited', {
          lang,
        }),
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        errorCode: ErrorCode.TOO_MANY_REQUESTS,
      });
    }
  }

  async recordOtpSent(tx: DrizzleTx): Promise<void> {
    await this.rateLimitRepository.recordOtpSent(tx, new Date());
  }
}
