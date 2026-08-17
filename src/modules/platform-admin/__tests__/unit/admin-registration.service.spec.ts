import { HttpStatus } from '@nestjs/common';
import { CustomException } from '@/libs/exceptions/custom.exception';
import { ErrorCode } from '@/libs/response/error.schema';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import { AppEnvService } from '@/libs/config/app-env.service';
import { MailService } from '@/libs/mail/mail.service';
import { OtpService } from '@/libs/otp/otp.service';
import { I18nService } from 'nestjs-i18n';
import { AuditService } from '@/modules/audit/audit.service';
import { AdminRegistrationAttemptRepository } from '../../admin-registration-attempt.repository';
import { AdminRegistrationRateLimiterService } from '../../admin-registration-rate-limiter.service';
import { AdminRegistrationService } from '../../admin-registration.service';
import { PlatformAdminLocalAuthRepository } from '../../platform-admin-local-auth.repository';
import { PlatformAdminRepository } from '../../platform-admin.repository';

jest.mock('@/libs/crypto/password', () => ({
  hashPassword: jest.fn(async (value: string) => `hashed:${value}`),
  verifyPassword: jest.fn(async (plain: string, hash: string) =>
    hash === `hashed:${plain}`,
  ),
}));

describe('AdminRegistrationService', () => {
  const drizzleService = {
    transaction: jest.fn(),
  };

  const platformAdminRepository = {
    findByEmail: jest.fn(),
    findByUserName: jest.fn(),
    insert: jest.fn(),
  };

  const platformAdminLocalAuthRepository = {
    insert: jest.fn(),
  };

  const attemptRepository = {
    findByEmail: jest.fn(),
    findByUserNameExcludingEmail: jest.fn(),
    upsertPendingRegistration: jest.fn(),
    deleteByEmail: jest.fn(),
  };

  const rateLimiter = {
    assertCanSendOtp: jest.fn(),
    recordOtpSent: jest.fn(),
  };

  const otpService = {
    generateOtp: jest.fn(),
  };

  const mailService = {
    sendAdminRegistrationOtp: jest.fn(),
  };

  const appEnv = {
    ADMIN_REGISTRATION_OTP_EMAIL: 'gatekeeper@example.com',
  };

  const auditService = {
    record: jest.fn(),
  };

  const i18n = {
    t: jest.fn((key: string) => key),
  };

  let service: AdminRegistrationService;

  const payload = {
    email: 'admin@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    userName: 'jane_admin',
    password: 'Secret123!',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    drizzleService.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => callback({}),
    );

    rateLimiter.assertCanSendOtp.mockResolvedValue(undefined);
    rateLimiter.recordOtpSent.mockResolvedValue(undefined);
    mailService.sendAdminRegistrationOtp.mockResolvedValue(undefined);
    auditService.record.mockResolvedValue(undefined);

    service = new AdminRegistrationService(
      drizzleService as unknown as DrizzleService,
      platformAdminRepository as unknown as PlatformAdminRepository,
      platformAdminLocalAuthRepository as unknown as PlatformAdminLocalAuthRepository,
      attemptRepository as unknown as AdminRegistrationAttemptRepository,
      rateLimiter as unknown as AdminRegistrationRateLimiterService,
      otpService as unknown as OtpService,
      mailService as unknown as MailService,
      appEnv as unknown as AppEnvService,
      auditService as unknown as AuditService,
      i18n as unknown as I18nService,
    );
  });

  it('requests OTP, stores pending registration, and emails gatekeeper', async () => {
    platformAdminRepository.findByEmail.mockResolvedValue(null);
    platformAdminRepository.findByUserName.mockResolvedValue(null);
    attemptRepository.findByUserNameExcludingEmail.mockResolvedValue(null);
    otpService.generateOtp.mockReturnValue('123456');
    attemptRepository.upsertPendingRegistration.mockResolvedValue({
      email: payload.email,
    });

    const result = await service.requestRegistrationOtp(payload, 'en');

    expect(rateLimiter.assertCanSendOtp).toHaveBeenCalled();
    expect(attemptRepository.upsertPendingRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        email: payload.email,
        passwordHash: 'hashed:Secret123!',
        otpHash: 'hashed:123456',
      }),
      expect.anything(),
    );
    expect(rateLimiter.recordOtpSent).toHaveBeenCalled();
    expect(mailService.sendAdminRegistrationOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'gatekeeper@example.com',
        otp: '123456',
        registrantEmail: payload.email,
      }),
    );
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it('rejects OTP request when email already exists', async () => {
    platformAdminRepository.findByEmail.mockResolvedValue({ id: 'existing' });

    await expect(service.requestRegistrationOtp(payload, 'en')).rejects.toMatchObject({
      statusCode: HttpStatus.CONFLICT,
      errorCode: ErrorCode.DUPLICATE_ENTRY,
    });

    expect(rateLimiter.assertCanSendOtp).not.toHaveBeenCalled();
  });

  it('rejects OTP request when username already exists on an admin', async () => {
    platformAdminRepository.findByEmail.mockResolvedValue(null);
    platformAdminRepository.findByUserName.mockResolvedValue({ id: 'existing' });

    await expect(service.requestRegistrationOtp(payload, 'en')).rejects.toMatchObject({
      statusCode: HttpStatus.CONFLICT,
      errorCode: ErrorCode.DUPLICATE_ENTRY,
    });
  });

  it('rejects OTP request when username is reserved by another pending registration', async () => {
    platformAdminRepository.findByEmail.mockResolvedValue(null);
    platformAdminRepository.findByUserName.mockResolvedValue(null);
    attemptRepository.findByUserNameExcludingEmail.mockResolvedValue({
      email: 'other@example.com',
    });

    await expect(service.requestRegistrationOtp(payload, 'en')).rejects.toMatchObject({
      statusCode: HttpStatus.CONFLICT,
      errorCode: ErrorCode.DUPLICATE_ENTRY,
    });
  });

  it('rejects OTP request when global rate limit is active', async () => {
    platformAdminRepository.findByEmail.mockResolvedValue(null);
    platformAdminRepository.findByUserName.mockResolvedValue(null);
    attemptRepository.findByUserNameExcludingEmail.mockResolvedValue(null);
    rateLimiter.assertCanSendOtp.mockRejectedValueOnce(
      new CustomException({
        message: 'message.error.adminRegistrationRateLimited',
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        errorCode: ErrorCode.TOO_MANY_REQUESTS,
      }),
    );

    await expect(service.requestRegistrationOtp(payload, 'en')).rejects.toMatchObject({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      errorCode: ErrorCode.TOO_MANY_REQUESTS,
    });

    expect(attemptRepository.upsertPendingRegistration).not.toHaveBeenCalled();
    expect(mailService.sendAdminRegistrationOtp).not.toHaveBeenCalled();
  });

  it('completes registration when OTP and payload match pending row', async () => {
    const pending = {
      email: payload.email,
      userName: payload.userName,
      firstName: payload.firstName,
      lastName: payload.lastName,
      passwordHash: 'hashed:Secret123!',
      otpHash: 'hashed:123456',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };

    const createdAdmin = {
      id: 'admin-1',
      firstName: payload.firstName,
      lastName: payload.lastName,
      userName: payload.userName,
      email: payload.email,
      status: 'active',
      role: 'platform_admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    attemptRepository.findByEmail.mockResolvedValue(pending);
    platformAdminRepository.insert.mockResolvedValue(createdAdmin);
    platformAdminLocalAuthRepository.insert.mockResolvedValue(undefined);

    const result = await service.completeRegistration(
      { ...payload, otp: '123456' },
      'en',
    );

    expect(platformAdminRepository.insert).toHaveBeenCalled();
    expect(platformAdminLocalAuthRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: 'admin-1',
        passwordHash: 'hashed:Secret123!',
        verified: true,
      }),
      expect.anything(),
    );
    expect(attemptRepository.deleteByEmail).toHaveBeenCalledWith(
      payload.email,
      expect.anything(),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.registration.completed',
        resourceId: 'admin-1',
      }),
      expect.anything(),
    );
    expect(result.id).toBe('admin-1');
  });

  it('rejects completion when OTP is invalid', async () => {
    const pending = {
      email: payload.email,
      userName: payload.userName,
      firstName: payload.firstName,
      lastName: payload.lastName,
      passwordHash: 'hashed:Secret123!',
      otpHash: 'hashed:123456',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };

    attemptRepository.findByEmail.mockResolvedValue(pending);

    await expect(
      service.completeRegistration({ ...payload, otp: '000000' }, 'en'),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: ErrorCode.INVALID_OTP,
    });

    expect(platformAdminRepository.insert).not.toHaveBeenCalled();
  });

  it('rejects completion when OTP is expired', async () => {
    const pending = {
      email: payload.email,
      userName: payload.userName,
      firstName: payload.firstName,
      lastName: payload.lastName,
      passwordHash: 'hashed:Secret123!',
      otpHash: 'hashed:123456',
      expiresAt: new Date(Date.now() - 1_000),
    };

    attemptRepository.findByEmail.mockResolvedValue(pending);

    await expect(
      service.completeRegistration({ ...payload, otp: '123456' }, 'en'),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: ErrorCode.INVALID_OTP,
    });
  });

  it('rejects completion when pending registration is missing', async () => {
    attemptRepository.findByEmail.mockResolvedValue(null);

    await expect(
      service.completeRegistration({ ...payload, otp: '123456' }, 'en'),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: ErrorCode.INVALID_OTP,
    });
  });
});
