import { HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { UserStatusEnum } from '@/_db/drizzle/enum';
import { ErrorCode } from '@/libs/response/error.schema';
import { AuthenticatedUser } from '@/libs/types/authenticated-user.type';
import { IdentityRepository } from '@/modules/identity/identity.repository';
import { AccountService } from '../../account.service';

jest.mock('@/libs/crypto/password', () => ({
  hashPassword: jest.fn(async (value: string) => `hashed:${value}`),
  verifyPassword: jest.fn(async (plain: string, hash: string) =>
    hash === `hashed:${plain}`,
  ),
}));

describe('AccountService', () => {
  const identityRepository = {
    upsertProfileDisplayName: jest.fn(),
    updatePasswordHash: jest.fn(),
  };

  const i18n = {
    t: jest.fn((key: string) => key),
  };

  let service: AccountService;

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
    emailVerified: true,
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
    refreshTokenHash: 'hash',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const auth: AuthenticatedUser = {
    user,
    credential,
    profile,
    session,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccountService(
      identityRepository as unknown as IdentityRepository,
      i18n as unknown as I18nService,
    );
  });

  it('updates profile display name', async () => {
    identityRepository.upsertProfileDisplayName.mockResolvedValue({
      ...profile,
      displayName: 'Updated Name',
    });

    const result = await service.updateProfile(
      auth,
      { name: 'Updated Name' },
      'en',
    );

    expect(identityRepository.upsertProfileDisplayName).toHaveBeenCalledWith(
      user.id,
      'Updated Name',
    );
    expect(result.displayName).toBe('Updated Name');
  });

  it('changes password when current password is correct', async () => {
    await service.changePassword(
      auth,
      {
        currentPassword: 'Password1!',
        newPassword: 'NewPassword1!',
      },
      'en',
    );

    expect(identityRepository.updatePasswordHash).toHaveBeenCalledWith(
      user.id,
      'hashed:NewPassword1!',
    );
  });

  it('rejects password change with wrong current password', async () => {
    await expect(
      service.changePassword(
        auth,
        {
          currentPassword: 'WrongPass1!',
          newPassword: 'NewPassword1!',
        },
        'en',
      ),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.UNAUTHORIZED,
      errorCode: ErrorCode.INVALID_CREDENTIALS,
    });

    expect(identityRepository.updatePasswordHash).not.toHaveBeenCalled();
  });
});
