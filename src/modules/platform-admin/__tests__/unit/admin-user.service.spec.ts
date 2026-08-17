import { UserStatusEnum } from '@/_db/drizzle/enum';
import { AuditService } from '@/modules/audit/audit.service';
import { IdentityRepository } from '@/modules/identity/identity.repository';
import { UserSessionRepository } from '@/modules/session/user-session.repository';
import { AdminUserNotFoundError, AdminUserSessionNotFoundError } from '../../domain/admin-user.errors';
import { AdminUserService } from '../../admin-user.service';

describe('AdminUserService', () => {
  const identityRepository = {
    list: jest.fn(),
    count: jest.fn(),
    findByIdWithCredentialAndProfile: jest.fn(),
    updateStatus: jest.fn(),
  };
  const userSessionRepository = {
    countByUserId: jest.fn(),
    revokeAllActiveByUserId: jest.fn(),
    listByUserId: jest.fn(),
    findByIdForUser: jest.fn(),
    revoke: jest.fn(),
  };
  const auditService = {
    findLatestUserLogin: jest.fn(),
  };

  let service: AdminUserService;

  const userRow = {
    user: {
      id: 'user-1',
      email: 'user@example.com',
      status: UserStatusEnum.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    credential: {
      userId: 'user-1',
      passwordHash: 'hashed',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    profile: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminUserService(
      identityRepository as unknown as IdentityRepository,
      userSessionRepository as unknown as UserSessionRepository,
      auditService as unknown as AuditService,
    );
  });

  it('lists users with search and status filters', async () => {
    identityRepository.list.mockResolvedValue([userRow]);
    identityRepository.count.mockResolvedValue(1);

    const result = await service.list({
      page: 1,
      limit: 20,
      q: 'user@',
      status: UserStatusEnum.ACTIVE,
    });

    expect(result.total).toBe(1);
    expect(identityRepository.list).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      q: 'user@',
      status: UserStatusEnum.ACTIVE,
    });
  });

  it('suspends user and revokes active sessions', async () => {
    identityRepository.findByIdWithCredentialAndProfile
      .mockResolvedValueOnce(userRow)
      .mockResolvedValueOnce({
        ...userRow,
        user: { ...userRow.user, status: UserStatusEnum.SUSPENDED },
      });
    userSessionRepository.revokeAllActiveByUserId.mockResolvedValue(2);

    const result = await service.suspend('user-1');

    expect(identityRepository.updateStatus).toHaveBeenCalledWith(
      'user-1',
      UserStatusEnum.SUSPENDED,
    );
    expect(userSessionRepository.revokeAllActiveByUserId).toHaveBeenCalledWith(
      'user-1',
    );
    expect(result.user.status).toBe(UserStatusEnum.SUSPENDED);
  });

  it('throws when user is not found', async () => {
    identityRepository.findByIdWithCredentialAndProfile.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      AdminUserNotFoundError,
    );
  });

  it('lists sessions for a user', async () => {
    const session = {
      id: 'session-1',
      userId: 'user-1',
      deviceInfo: { userAgent: 'test' },
      ip: '127.0.0.1',
      refreshTokenHash: 'hash',
      revokedAt: null,
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    identityRepository.findByIdWithCredentialAndProfile.mockResolvedValue(userRow);
    userSessionRepository.listByUserId.mockResolvedValue([session]);
    userSessionRepository.countByUserId.mockResolvedValue({ total: 1, active: 1 });

    const result = await service.listSessions('user-1', { page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(userSessionRepository.listByUserId).toHaveBeenCalledWith('user-1', {
      limit: 20,
      offset: 0,
    });
  });

  it('revokes a session belonging to the user', async () => {
    const session = {
      id: 'session-1',
      userId: 'user-1',
      deviceInfo: {},
      ip: null,
      refreshTokenHash: 'hash',
      revokedAt: null,
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    identityRepository.findByIdWithCredentialAndProfile.mockResolvedValue(userRow);
    userSessionRepository.findByIdForUser.mockResolvedValue(session);
    userSessionRepository.revoke.mockResolvedValue({
      ...session,
      revokedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    const result = await service.revokeSession('user-1', 'session-1');

    expect(result.revokedAt).toBeTruthy();
    expect(userSessionRepository.revoke).toHaveBeenCalledWith('session-1');
  });

  it('throws when session is not found for user', async () => {
    identityRepository.findByIdWithCredentialAndProfile.mockResolvedValue(userRow);
    userSessionRepository.findByIdForUser.mockResolvedValue(null);

    await expect(
      service.revokeSession('user-1', 'missing-session'),
    ).rejects.toBeInstanceOf(AdminUserSessionNotFoundError);
  });
});
