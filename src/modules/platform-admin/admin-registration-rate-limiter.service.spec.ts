import { HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ErrorCode } from '@/libs/response/error.schema';
import { AdminRegistrationRateLimitRepository } from './admin-registration-rate-limit.repository';
import {
  ADMIN_REGISTRATION_OTP_COOLDOWN_MS,
  AdminRegistrationRateLimiterService,
} from './admin-registration-rate-limiter.service';

describe('AdminRegistrationRateLimiterService', () => {
  const rateLimitRepository = {
    getLastOtpSentAtForUpdate: jest.fn(),
    recordOtpSent: jest.fn(),
  };

  const i18n = {
    t: jest.fn((key: string) => key),
  };

  let service: AdminRegistrationRateLimiterService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminRegistrationRateLimiterService(
      rateLimitRepository as unknown as AdminRegistrationRateLimitRepository,
      i18n as unknown as I18nService,
    );
  });

  it('allows OTP when no prior send exists', async () => {
    rateLimitRepository.getLastOtpSentAtForUpdate.mockResolvedValue(null);

    await expect(
      service.assertCanSendOtp({} as never, 'en'),
    ).resolves.toBeUndefined();
  });

  it('allows OTP when cooldown has elapsed', async () => {
    const lastSentAt = new Date(
      Date.now() - ADMIN_REGISTRATION_OTP_COOLDOWN_MS - 1_000,
    );
    rateLimitRepository.getLastOtpSentAtForUpdate.mockResolvedValue(lastSentAt);

    await expect(
      service.assertCanSendOtp({} as never, 'en'),
    ).resolves.toBeUndefined();
  });

  it('rejects OTP when cooldown is active', async () => {
    rateLimitRepository.getLastOtpSentAtForUpdate.mockResolvedValue(new Date());

    await expect(service.assertCanSendOtp({} as never, 'en')).rejects.toMatchObject({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      errorCode: ErrorCode.TOO_MANY_REQUESTS,
    });
  });

  it('records OTP send timestamp', async () => {
    const sentAt = new Date();
    await service.recordOtpSent({} as never);
    expect(rateLimitRepository.recordOtpSent).toHaveBeenCalledWith(
      {},
      expect.any(Date),
    );
    void sentAt;
  });
});
