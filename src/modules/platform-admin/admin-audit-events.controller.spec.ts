import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { AuditActionEnum } from '@/_db/drizzle/enum/audit-action.enum';
import { AuditActorTypeEnum } from '@/_db/drizzle/enum/audit-actor-type.enum';
import { PlatformAdminAuthGuard } from '@/libs/guards/platform-admin-auth.guard';
import { ResponseService } from '@/libs/response/response.service';
import { AuditService } from '@/modules/audit/audit.service';
import { AdminAuditEventsController } from './admin-audit-events.controller';

describe('AdminAuditEventsController', () => {
  let controller: AdminAuditEventsController;
  const auditService = {
    list: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuditEventsController],
      providers: [
        ResponseService,
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

    controller = module.get(AdminAuditEventsController);
  });

  it('lists audit events with pagination meta', async () => {
    auditService.list.mockResolvedValue({
      items: [
        {
          id: 'event-1',
          actorType: AuditActorTypeEnum.PLATFORM_ADMIN,
          actorId: 'admin-1',
          action: AuditActionEnum.CLIENT_CREATED,
          resourceType: 'oauth_client',
          resourceId: 'client-1',
          metadata: { clientId: 'byte-forge-web' },
          ip: '127.0.0.1',
          userAgent: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await controller.list({
      page: 1,
      limit: 20,
      action: AuditActionEnum.CLIENT_CREATED,
    } as never);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].action).toBe(AuditActionEnum.CLIENT_CREATED);
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, pages: 1 });
    expect(auditService.list).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      action: AuditActionEnum.CLIENT_CREATED,
      actorId: undefined,
      from: undefined,
      to: undefined,
    });
  });
});
