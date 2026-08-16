import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { UserStatusEnum } from '@/_db/drizzle/enum';
import { AuditService } from '@/modules/audit/audit.service';
import { ResponseService } from '@/libs/response/response.service';
import { PlatformAdminAuthGuard } from '@/libs/guards/platform-admin-auth.guard';
import { AdminUserService } from './admin-user.service';
import { AdminUsersController } from './admin-users.controller';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  const adminUserService = {
    list: jest.fn(),
    findById: jest.fn(),
    suspend: jest.fn(),
    activate: jest.fn(),
  };
  const auditService = {
    record: jest.fn(),
  };

  const userRow = {
    user: {
      id: 'user-1',
      email: 'user@example.com',
      status: UserStatusEnum.ACTIVE,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    },
    credential: {
      userId: 'user-1',
      passwordHash: 'hashed',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    profile: {
      userId: 'user-1',
      displayName: 'Jane Doe',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    auditService.record.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        ResponseService,
        { provide: AdminUserService, useValue: adminUserService },
        { provide: AuditService, useValue: auditService },
        {
          provide: I18nService,
          useValue: { t: jest.fn((key: string) => key) },
        },
      ],
    })
      .overrideGuard(PlatformAdminAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminUsersController);
  });

  it('lists users with pagination meta', async () => {
    adminUserService.list.mockResolvedValue({
      items: [userRow],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await controller.list({ page: 1, limit: 20 } as never);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].email).toBe('user@example.com');
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, pages: 1 });
  });

  it('fetches user detail with auth summary', async () => {
    adminUserService.findById.mockResolvedValue({
      user: userRow,
      sessionCount: 3,
      activeSessionCount: 1,
      lastLoginAt: new Date('2026-01-03T00:00:00.000Z'),
    });

    const result = await controller.getById('user-1');

    expect(result.data.sessionCount).toBe(3);
    expect(result.data.activeSessionCount).toBe(1);
    expect(result.data.lastLoginAt).toEqual(new Date('2026-01-03T00:00:00.000Z'));
  });

  it('suspends a user and records audit', async () => {
    adminUserService.suspend.mockResolvedValue({
      ...userRow,
      user: { ...userRow.user, status: UserStatusEnum.SUSPENDED },
    });

    const auth = {
      admin: { id: 'admin-1' },
      session: { id: 'session-1' },
    } as never;

    const result = await controller.suspend(
      'user-1',
      auth,
      { headers: {}, socket: { remoteAddress: '127.0.0.1' } } as never,
    );

    expect(result.data.status).toBe(UserStatusEnum.SUSPENDED);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.suspended' }),
    );
  });
});
