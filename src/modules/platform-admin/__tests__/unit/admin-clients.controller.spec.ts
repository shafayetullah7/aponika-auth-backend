import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { AuditService } from '@/modules/audit/audit.service';
import { OAuthClientService } from '@/modules/oauth/oauth-client.service';
import { ResponseService } from '@/libs/response/response.service';
import { PlatformAdminAuthGuard } from '@/libs/guards/platform-admin-auth.guard';
import { AdminClientsController } from '../../admin-clients.controller';

describe('AdminClientsController', () => {
  let controller: AdminClientsController;
  const oauthClientService = {
    create: jest.fn(),
    findById: jest.fn(),
  };
  const auditService = {
    record: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    auditService.record.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminClientsController],
      providers: [
        ResponseService,
        { provide: OAuthClientService, useValue: oauthClientService },
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

    controller = module.get(AdminClientsController);
  });

  it('creates a client and fetches it by id', async () => {
    const created = {
      client: {
        id: 'client-uuid',
        clientId: 'byte-forge-web',
        name: 'Byte Forge Web',
        description: null,
        clientType: 'public',
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        scopes: ['openid'],
        pkceRequired: true,
        status: 'active',
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      uris: [
        {
          id: 'uri-1',
          oauthClientId: 'client-uuid',
          uri: 'http://localhost:3000/auth/callback',
          kind: 'redirect',
          createdAt: new Date(),
        },
      ],
    };

    oauthClientService.create.mockResolvedValue(created);
    oauthClientService.findById.mockResolvedValue(created);

    const auth = {
      admin: { id: 'admin-1' },
      session: { id: 'session-1' },
    } as never;

    const createResult = await controller.create(
      {
        clientId: 'byte-forge-web',
        name: 'Byte Forge Web',
        clientType: 'public',
        redirectUris: ['http://localhost:3000/auth/callback'],
      } as never,
      auth,
      { headers: {}, socket: { remoteAddress: '127.0.0.1' } } as never,
    );

    expect(createResult.data.clientId).toBe('byte-forge-web');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'client.created' }),
    );

    const fetchResult = await controller.getById('client-uuid');
    expect(fetchResult.data.clientId).toBe('byte-forge-web');
    expect(oauthClientService.findById).toHaveBeenCalledWith('client-uuid');
  });
});
