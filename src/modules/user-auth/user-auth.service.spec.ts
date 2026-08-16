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
import { UserAuthService } from './user-auth.service';

jest.mock('@/libs/crypto/password', () => ({
  hashPassword: jest.fn(async (value: string) => `hashed:${value}`),
}));

jest.mock('@/libs/verification/email-verification-token', () => ({
  generateEmailVerificationToken: jest.fn(() => 'plain-verification-token'),
  hashEmailVerificationToken: jest.fn((token: string) => `hash:${token}`),
}));

describe('UserAuthService', () => {
  const identityRepository = {
    findByEmail: jest.fn(),
    createUserWithCredential: jest.fn(),
    findCredentialByUserId: jest.fn(),
    markEmailVerified: jest.fn(),
  };

  const emailVerificationRepository = {
    create: jest.fn(),
    findActiveByTokenHash: jest.fn(),
    markConsumed: jest.fn(),
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

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserAuthService(
      identityRepository as unknown as IdentityRepository,
      emailVerificationRepository as unknown as EmailVerificationRepository,
      auditService as unknown as AuditService,
      mailService as unknown as MailService,
      drizzleService as unknown as DrizzleService,
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
});
