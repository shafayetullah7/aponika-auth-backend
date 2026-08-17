import { HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { UserStatusEnum } from '@/_db/drizzle/enum';
import { AuditActionEnum } from '@/_db/drizzle/enum/audit-action.enum';
import { AuditActorTypeEnum } from '@/_db/drizzle/enum/audit-actor-type.enum';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import { ErrorCode } from '@/libs/response/error.schema';
import { hashEmailVerificationToken } from '@/libs/verification/email-verification-token';
import { AuditService } from '@/modules/audit/audit.service';
import { EmailVerificationRepository } from '@/modules/identity/email-verification.repository';
import { IdentityRepository } from '@/modules/identity/identity.repository';
import { MailService } from '@/libs/mail/mail.service';
import { UserSessionService } from '@/modules/session/user-session.service';
import { UserLoginRateLimiterService } from '../../user-login-rate-limiter.service';
import { UserAuthService } from '../../user-auth.service';

jest.mock('@/libs/crypto/password', () => ({
  hashPassword: jest.fn(async (value: string) => `hashed:${value}`),
  verifyPassword: jest.fn(async (plain: string, hash: string) =>
    hash === `hashed:${plain}`,
  ),
}));

jest.mock('@/libs/verification/email-verification-token', () => ({
  generateEmailVerificationToken: jest.fn(() => 'plain-verification-token'),
  hashEmailVerificationToken: jest.fn((token: string) => `hash:${token}`),
}));

describe('UserAuthService', () => {
  const identityRepository = {
    findByEmail: jest.fn(),
    findByEmailWithCredentialAndProfile: jest.fn(),
    createUserWithCredential: jest.fn(),
    findCredentialByUserId: jest.fn(),
    markEmailVerified: jest.fn(),
  };

  const emailVerificationRepository = {
    create: jest.fn(),
    findActiveByTokenHash: jest.fn(),
    markConsumed: jest.fn(),
  };

  const userSessionService = {
    createSession: jest.fn(),
    setRefreshTokenHash: jest.fn(),
    getSessionWithUser: jest.fn(),
    isSessionActive: jest.fn(),
    revokeSession: jest.fn(),
  };

  const userLoginRateLimiter = {
    assertCanAttempt: jest.fn(),
    recordFailedAttempt: jest.fn(),
    reset: jest.fn(),
  };
  const userRegistrationRateLimiter = {
    assertCanAttempt: jest.fn(),
    recordAttempt: jest.fn(),
  };

  const auditService = {
    record: jest.fn(),
  };

  const mailService = {
    sendEmailVerification: jest.fn(),
  };

  const drizzleService = {
    transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback('tx'),
    ),
  };

  const jwtService = {
    signAsync: jest.fn(async () => 'signed-token'),
    verifyAsync: jest.fn(),
  };

  const appEnv = {
    JWT_USER_ACCESS_SECRET: 'user-access-secret',
    JWT_USER_REFRESH_SECRET: 'user-refresh-secret',
    JWT_USER_ACCESS_EXP: '15m',
    JWT_USER_REFRESH_EXP: '7d',
  };

  const i18n = {
    t: jest.fn((key: string) => key),
  };

  let service: UserAuthService;

  const user = {
    id: 'user-1',
    email: 'user@example.com',
    status: UserStatusEnum.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const credential = {
    userId: user.id,
    passwordHash: 'hashed:Password1!',
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const profile = {
    userId: user.id,
    displayName: 'Jane Doe',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const session = {
    id: 'session-1',
    userId: user.id,
    deviceInfo: {},
    ip: '127.0.0.1',
    refreshTokenHash: 'hashed:placeholder',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserAuthService(
      identityRepository as unknown as IdentityRepository,
      emailVerificationRepository as unknown as EmailVerificationRepository,
      userSessionService as unknown as UserSessionService,
      userLoginRateLimiter as unknown as UserLoginRateLimiterService,
      userRegistrationRateLimiter as unknown as import('../../user-registration-rate-limiter.service').UserRegistrationRateLimiterService,
      auditService as unknown as AuditService,
      mailService as unknown as MailService,
      drizzleService as unknown as DrizzleService,
      jwtService as unknown as import('@nestjs/jwt').JwtService,
      appEnv as never,
      i18n as unknown as I18nService,
    );
  });

  it('registers a user, stores verification token, audits, and sends email', async () => {
    identityRepository.findByEmail.mockResolvedValue(null);
    identityRepository.createUserWithCredential.mockResolvedValue({
      user,
      credential,
      profile,
    });
    emailVerificationRepository.create.mockResolvedValue({
      id: 'verification-1',
    });

    const result = await service.register(
      {
        email: user.email,
        password: 'Password1!',
        name: profile.displayName,
      },
      'en',
      '127.0.0.1',
    );

    expect(result).toEqual({
      id: user.id,
      email: user.email,
      displayName: profile.displayName,
      emailVerified: false,
      status: user.status,
    });
    expect(emailVerificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        tokenHash: 'hash:plain-verification-token',
      }),
      'tx',
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: AuditActorTypeEnum.USER,
        actorId: user.id,
        action: AuditActionEnum.USER_REGISTERED,
        resourceType: 'user',
        resourceId: user.id,
        ip: '127.0.0.1',
      }),
      'tx',
    );
    expect(mailService.sendEmailVerification).toHaveBeenCalledWith({
      to: user.email,
      token: 'plain-verification-token',
      displayName: profile.displayName,
    });
  });

  it('throws 409 when email already exists', async () => {
    identityRepository.findByEmail.mockResolvedValue(user);

    await expect(
      service.register(
        {
          email: user.email,
          password: 'Password1!',
          name: 'Jane Doe',
        },
        'en',
      ),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.CONFLICT,
      errorCode: ErrorCode.DUPLICATE_ENTRY,
    });

    expect(identityRepository.createUserWithCredential).not.toHaveBeenCalled();
  });

  it('verifies email and marks credential verified', async () => {
    const verification = {
      id: 'verification-1',
      userId: user.id,
      tokenHash: hashEmailVerificationToken('plain-verification-token'),
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      createdAt: new Date(),
    };

    emailVerificationRepository.findActiveByTokenHash.mockResolvedValue(
      verification,
    );
    identityRepository.findCredentialByUserId.mockResolvedValue(credential);

    const result = await service.verifyEmail(
      { token: 'plain-verification-token' },
      'en',
    );

    expect(result).toEqual({ emailVerified: true });
    expect(identityRepository.markEmailVerified).toHaveBeenCalledWith(
      user.id,
      'tx',
    );
    expect(emailVerificationRepository.markConsumed).toHaveBeenCalledWith(
      verification.id,
      'tx',
    );
  });

  it('rejects invalid verification tokens', async () => {
    emailVerificationRepository.findActiveByTokenHash.mockResolvedValue(null);

    await expect(
      service.verifyEmail({ token: 'bad-token' }, 'en'),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: ErrorCode.INVALID_EMAIL_VERIFICATION_TOKEN,
    });
  });

  it('treats repeat verification as idempotent success', async () => {
    const verification = {
      id: 'verification-1',
      userId: user.id,
      tokenHash: 'hash:plain-verification-token',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      createdAt: new Date(),
    };

    emailVerificationRepository.findActiveByTokenHash.mockResolvedValue(
      verification,
    );
    identityRepository.findCredentialByUserId.mockResolvedValue({
      ...credential,
      emailVerified: true,
    });

    const result = await service.verifyEmail(
      { token: 'plain-verification-token' },
      'en',
    );

    expect(result).toEqual({ emailVerified: true });
    expect(identityRepository.markEmailVerified).not.toHaveBeenCalled();
    expect(emailVerificationRepository.markConsumed).toHaveBeenCalledWith(
      verification.id,
      'tx',
    );
  });

  it('logs in verified users and audits success', async () => {
    identityRepository.findByEmailWithCredentialAndProfile.mockResolvedValue({
      user,
      credential: { ...credential, emailVerified: true },
      profile,
    });
    userSessionService.createSession.mockResolvedValue(session);

    const result = await service.login(
      { email: user.email, password: 'Password1!' },
      { userAgent: 'jest' },
      '127.0.0.1',
      'en',
    );

    expect(result.user.emailVerified).toBe(true);
    expect(userSessionService.setRefreshTokenHash).toHaveBeenCalled();
    expect(userLoginRateLimiter.reset).toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditActionEnum.USER_LOGIN_SUCCESS,
        actorId: user.id,
      }),
    );
  });

  it('rejects login for unverified email', async () => {
    identityRepository.findByEmailWithCredentialAndProfile.mockResolvedValue({
      user,
      credential,
      profile,
    });

    await expect(
      service.login(
        { email: user.email, password: 'Password1!' },
        {},
        '127.0.0.1',
        'en',
      ),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.UNAUTHORIZED,
      errorCode: ErrorCode.INVALID_CREDENTIALS,
    });

    expect(userSessionService.createSession).not.toHaveBeenCalled();
    expect(userLoginRateLimiter.recordFailedAttempt).toHaveBeenCalled();
  });

  it('rejects login with wrong password', async () => {
    identityRepository.findByEmailWithCredentialAndProfile.mockResolvedValue({
      user,
      credential: { ...credential, emailVerified: true },
      profile,
    });

    await expect(
      service.login(
        { email: user.email, password: 'WrongPass1!' },
        {},
        '127.0.0.1',
        'en',
      ),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.UNAUTHORIZED,
      errorCode: ErrorCode.INVALID_CREDENTIALS,
    });
  });

  it('revokes the session and audits logout', async () => {
    await service.logout(session.id, user.id, '127.0.0.1');

    expect(userSessionService.revokeSession).toHaveBeenCalledWith(session.id);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: AuditActorTypeEnum.USER,
        actorId: user.id,
        action: AuditActionEnum.USER_LOGOUT,
        resourceType: 'user_session',
        resourceId: session.id,
        ip: '127.0.0.1',
      }),
    );
  });

  it('rejects refresh when session is revoked', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      sessionId: session.id,
    });
    userSessionService.getSessionWithUser.mockResolvedValue({
      session: { ...session, revokedAt: new Date() },
      user,
      credential: { ...credential, emailVerified: true },
      profile,
    });
    userSessionService.isSessionActive.mockReturnValue(false);

    await expect(service.refreshTokens('refresh-token')).rejects.toMatchObject({
      message: 'Session revoked or expired',
    });
  });
});
