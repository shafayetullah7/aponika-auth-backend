import { Test, TestingModule } from '@nestjs/testing';
import { AuditActionEnum } from '@/_db/drizzle/enum/audit-action.enum';
import { AuditActorTypeEnum } from '@/_db/drizzle/enum/audit-actor-type.enum';
import { AuditRepository } from '../../audit.repository';
import { AuditService } from '../../audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let repository: jest.Mocked<
    Pick<AuditRepository, 'insert' | 'list' | 'count'>
  >;

  beforeEach(async () => {
    repository = {
      insert: jest.fn(),
      list: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: AuditRepository,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(AuditService);
  });

  it('record() persists an audit event via the repository', async () => {
    const createdAt = new Date('2026-08-16T00:00:00.000Z');
    repository.insert.mockResolvedValue({
      id: 'event-uuid',
      actorType: AuditActorTypeEnum.SYSTEM,
      actorId: null,
      action: AuditActionEnum.CLIENT_CREATED,
      resourceType: 'oauth_client',
      resourceId: 'client-uuid',
      metadata: { clientId: 'byte-forge-web' },
      ip: '127.0.0.1',
      userAgent: 'jest',
      createdAt,
    });

    const result = await service.record({
      actorType: AuditActorTypeEnum.SYSTEM,
      action: AuditActionEnum.CLIENT_CREATED,
      resourceType: 'oauth_client',
      resourceId: 'client-uuid',
      metadata: { clientId: 'byte-forge-web' },
      ip: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(repository.insert).toHaveBeenCalledWith(
      {
        actorType: AuditActorTypeEnum.SYSTEM,
        actorId: null,
        action: AuditActionEnum.CLIENT_CREATED,
        resourceType: 'oauth_client',
        resourceId: 'client-uuid',
        metadata: { clientId: 'byte-forge-web' },
        ip: '127.0.0.1',
        userAgent: 'jest',
      },
      undefined,
    );
    expect(result.id).toBe('event-uuid');
    expect(result.action).toBe(AuditActionEnum.CLIENT_CREATED);
  });

  it('list() returns paginated audit events', async () => {
    repository.list.mockResolvedValue([]);
    repository.count.mockResolvedValue(0);

    const result = await service.list({
      page: 2,
      limit: 10,
      action: AuditActionEnum.USER_SUSPENDED,
      actorId: 'admin-1',
    });

    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(repository.list).toHaveBeenCalledWith({
      limit: 10,
      offset: 10,
      action: AuditActionEnum.USER_SUSPENDED,
      actorId: 'admin-1',
      from: undefined,
      to: undefined,
    });
    expect(repository.count).toHaveBeenCalledWith({
      action: AuditActionEnum.USER_SUSPENDED,
      actorId: 'admin-1',
      from: undefined,
      to: undefined,
    });
  });
});
