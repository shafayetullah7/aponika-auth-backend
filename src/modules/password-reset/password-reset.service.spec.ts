import { JwtService } from '@nestjs/jwt';
import { I18nService } from 'nestjs-i18n';
import { AuditActionEnum } from '@/_db/drizzle/enum/audit-action.enum';
import { UserStatusEnum } from '@/_db/drizzle/enum';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import { AppEnvService } from '@/libs/config/app-env.service';
import { MailService } from '@/libs/mail/mail.service';
import { OtpService } from '@/libs/otp/otp.service';
import { AuditService } from '@/modules/audit/audit.service';
import { IdentityRepository } from '@/modules/identity/identity.repository';
import { PasswordResetAttemptRepository } from './password-reset-attempt.repository';
import { PasswordResetRateLimiterService } from './password-reset-rate-limiter.service';
import { PasswordResetService } from './password-reset.service';

jest.mock('@/libs/crypto/password', () => ({
  hashPassword: jest.fn(async (value: string) => `hashed:${value}`),
  verifyPassword: jest.fn(async (plain: string, hash: string) =>
    hash === `hashed:${plain}`,
  ),
}));

describe('PasswordResetService', () => {
  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const appEnv = {
    JWT_SECRET_RESET_REQUEST: 'request-secret-32-characters-minimum',
    JWT_SECRET_RESET_ACCESS: 'access-secret-32-characters-minimum',
  };

  const identityRepository = {
    findByEmail: jest.fn(),
    findByEmailWithCredentialAndProfile: jest.fn(),
    updatePasswordHash: jest.fn(),
  };

  const attemptRepository = {
    upsertAttempt: jest.fn(),
    findByEmail: jest.fn(),
    deleteByEmail: jest.fn(),
  };

  const rateLimiter = {
    assertCanRequest: jest.fn(),
    assertCanSendOtp: jest.fn(),
    recordRequest: jest.fn(),
    recordOtpSent: jest.fn(),
  };

  const otpService = {
    generateOtp: jest.fn(() => '123456'),
  };

  const mailService = {
    sendPasswordResetOtp: jest.fn(),
  };

  const auditService = {
    record: jest.fn(),
  };

  const drizzleService = {
    transaction: jest.fn(async (callback: (tx: unknown) => Promise<void>) =>
      callback({}),
    ),
  };

  const i18n = {
    t: jest.fn((key: string) => key),
  };

  let service: PasswordResetService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PasswordResetService(
      jwtService as unknown as JwtService,
      appEnv as unknown as AppEnvService,
      identityRepository as unknown as IdentityRepository,
      attemptRepository as unknown as PasswordResetAttemptRepository,
      rateLimiter as unknown as PasswordResetRateLimiterService,
      otpService as unknown as OtpService,
      mailService as unknown as MailService,
      auditService as unknown as AuditService,
      drizzleService as unknown as DrizzleService,
      i18n as unknown as I18nService,
    );
  });

  it('requests reset and sends OTP when user exists', async () => {
    identityRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      status: UserStatusEnum.ACTIVE,
    });
    jwtService.signAsync.mockResolvedValue('request-token');

    const result = await service.requestReset(
      { email: 'user@example.com' },
      'en',
      '127.0.0.1',
    );

    expect(rateLimiter.assertCanRequest).toHaveBeenCalled();
    expect(attemptRepository.upsertAttempt).toHaveBeenCalled();
    expect(mailService.sendPasswordResetOtp).toHaveBeenCalledWith({
      to: 'user@example.com',
      otp: '123456',
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditActionEnum.USER_PASSWORD_RESET_REQUESTED,
      }),
    );
    expect(result.token).toBe('request-token');
  });

  it('returns request token even when user does not exist', async () => {
    identityRepository.findByEmail.mockResolvedValue(null);
    jwtService.signAsync.mockResolvedValue('request-token');

    const result = await service.requestReset(
      { email: 'missing@example.com' },
      'en',
    );

    expect(attemptRepository.upsertAttempt).not.toHaveBeenCalled();
    expect(mailService.sendPasswordResetOtp).not.toHaveBeenCalled();
    expect(result.token).toBe('request-token');
  });

  it('confirms reset with access token', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      email: 'user@example.com',
      purpose: 'reset-access',
    });
    identityRepository.findByEmailWithCredentialAndProfile.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com' },
      credential: { passwordHash: 'old' },
      profile: null,
    });

    await service.confirmReset(
      { token: 'access-token', password: 'NewPassword1!' },
      'en',
    );

    expect(identityRepository.updatePasswordHash).toHaveBeenCalledWith(
      'user-1',
      'hashed:NewPassword1!',
      expect.anything(),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditActionEnum.USER_PASSWORD_RESET_COMPLETED,
      }),
      expect.anything(),
    );
  });
});
