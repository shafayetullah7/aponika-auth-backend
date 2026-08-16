import { Test, TestingModule } from '@nestjs/testing';
import { AuditActionEnum } from '@/_db/drizzle/enum/audit-action.enum';
import { AuditActorTypeEnum } from '@/_db/drizzle/enum/audit-actor-type.enum';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let repository: jest.Mocked<Pick<AuditRepository, 'insert'>>;

  beforeEach(async () => {
    repository = {
      insert: jest.fn(),
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
});
