import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { I18nService } from 'nestjs-i18n';
import { PlatformAdminStatusEnum } from '@/_db/drizzle/enum/platform-admin-status.enum';
import { AppEnvService } from '@/libs/config/app-env.service';
import { ErrorCode } from '@/libs/response/error.schema';
import { AuditService } from '@/modules/audit/audit.service';
import { AdminSessionService } from '@/modules/session/admin-session.service';
import { AdminLoginRateLimiterService } from './admin-login-rate-limiter.service';
import { PlatformAdminAuthService } from './platform-admin-auth.service';
import { PlatformAdminLocalAuthRepository } from './platform-admin-local-auth.repository';
import { AdminRegistrationService } from './admin-registration.service';

jest.mock('@/libs/crypto/password', () => ({
  hashPassword: jest.fn(async (value: string) => `hashed:${value}`),
  verifyPassword: jest.fn(async (plain: string, hash: string) =>
    hash === `hashed:${plain}`,
  ),
}));

describe('PlatformAdminAuthService', () => {
  const platformAdminLocalAuthRepository = {
    findByEmail: jest.fn(),
  };

  const adminSessionService = {
    createSession: jest.fn(),
    setRefreshTokenHash: jest.fn(),
    getSessionWithAdmin: jest.fn(),
    isSessionActive: jest.fn(),
    revokeSession: jest.fn(),
  };

  const adminRegistrationService = {
    requestRegistrationOtp: jest.fn(),
    completeRegistration: jest.fn(),
  };

  const adminLoginRateLimiter = {
    assertCanAttempt: jest.fn(),
    recordFailedAttempt: jest.fn(),
    reset: jest.fn(),
  };

  const auditService = {
    record: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const appEnv = {
    JWT_ADMIN_ACCESS_SECRET: 'access-secret',
    JWT_ADMIN_REFRESH_SECRET: 'refresh-secret',
    JWT_ADMIN_ACCESS_EXP: '15m',
    JWT_ADMIN_REFRESH_EXP: '7d',
  };

  const i18n = {
    t: jest.fn((key: string) => key),
  };

  let service: PlatformAdminAuthService;

  const admin = {
    id: 'admin-1',
    firstName: 'Jane',
    lastName: 'Doe',
    userName: 'jane_admin',
    email: 'jane@example.com',
    status: PlatformAdminStatusEnum.ACTIVE,
    role: 'platform_admin' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const payload = {
    email: 'jane@example.com',
    password: 'Secret123!',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    auditService.record.mockResolvedValue(undefined);
    adminLoginRateLimiter.assertCanAttempt.mockReturnValue(undefined);

    service = new PlatformAdminAuthService(
      platformAdminLocalAuthRepository as unknown as PlatformAdminLocalAuthRepository,
      adminSessionService as unknown as AdminSessionService,
      adminRegistrationService as unknown as AdminRegistrationService,
      adminLoginRateLimiter as unknown as AdminLoginRateLimiterService,
      auditService as unknown as AuditService,
      jwtService as unknown as JwtService,
      appEnv as unknown as AppEnvService,
      i18n as unknown as I18nService,
    );
  });

  it('logs in a verified active admin and records audit success', async () => {
    platformAdminLocalAuthRepository.findByEmail.mockResolvedValue({
      admin,
      localAuth: {
        adminId: admin.id,
        passwordHash: 'hashed:Secret123!',
        verified: true,
      },
    });
    adminSessionService.createSession.mockResolvedValue({
      id: 'session-1',
      adminId: admin.id,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      refreshTokenHash: 'placeholder',
    });
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    adminSessionService.setRefreshTokenHash.mockResolvedValue(undefined);

    const result = await service.login(payload, { userAgent: 'jest' }, '127.0.0.1', 'en');

    expect(result.tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(adminSessionService.setRefreshTokenHash).toHaveBeenCalledWith(
      'session-1',
      'refresh-token',
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.login.success' }),
    );
    expect(adminLoginRateLimiter.reset).toHaveBeenCalled();
  });

  it('rejects login for unverified admin', async () => {
    platformAdminLocalAuthRepository.findByEmail.mockResolvedValue({
      admin,
      localAuth: {
        adminId: admin.id,
        passwordHash: 'hashed:Secret123!',
        verified: false,
      },
    });

    await expect(
      service.login(payload, { userAgent: 'jest' }, '127.0.0.1', 'en'),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.UNAUTHORIZED,
      errorCode: ErrorCode.INVALID_CREDENTIALS,
    });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.login.failure' }),
    );
  });

  it('rejects login for suspended admin', async () => {
    platformAdminLocalAuthRepository.findByEmail.mockResolvedValue({
      admin: { ...admin, status: PlatformAdminStatusEnum.SUSPENDED },
      localAuth: {
        adminId: admin.id,
        passwordHash: 'hashed:Secret123!',
        verified: true,
      },
    });

    await expect(
      service.login(payload, { userAgent: 'jest' }, '127.0.0.1', 'en'),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.UNAUTHORIZED,
      errorCode: ErrorCode.INVALID_CREDENTIALS,
    });
  });
});
