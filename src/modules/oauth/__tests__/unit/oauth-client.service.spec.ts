import { Test, TestingModule } from '@nestjs/testing';
import {
  OAuthClientStatusEnum,
  OAuthClientTypeEnum,
  OAuthClientUriKindEnum,
} from '@/_db/drizzle/enum';
import { OAuthClientConflictError } from '../../domain/oauth-client.errors';
import { OAuthClientRepository } from '../../repositories/oauth-client.repository';
import { OAuthClientService } from '../../oauth-client.service';
import { OidcClientRegistry } from '../../oidc/client/oidc-client.registry';

jest.mock('@/libs/crypto/password', () => ({
  generateClientSecret: jest.fn(() => 'generated-client-secret'),
  hashPassword: jest.fn(async () => 'hashed-client-secret'),
}));

describe('OAuthClientService', () => {
  let service: OAuthClientService;
  let oidcClientRegistry: { invalidate: jest.Mock };
  let repository: jest.Mocked<
    Pick<
      OAuthClientRepository,
      | 'createWithUris'
      | 'findByClientId'
      | 'findByIdWithUris'
      | 'update'
      | 'replaceUris'
    >
  >;

  const createdAt = new Date('2026-08-16T00:00:00.000Z');

  beforeEach(async () => {
    oidcClientRegistry = {
      invalidate: jest.fn(),
    };

    repository = {
      createWithUris: jest.fn(),
      findByClientId: jest.fn(),
      findByIdWithUris: jest.fn(),
      update: jest.fn(),
      replaceUris: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthClientService,
        {
          provide: OAuthClientRepository,
          useValue: repository,
        },
        {
          provide: OidcClientRegistry,
          useValue: oidcClientRegistry,
        },
      ],
    }).compile();

    service = module.get(OAuthClientService);
  });

  it('creates a public client with PKCE enforced and no secret', async () => {
    repository.findByClientId.mockResolvedValue(null);
    repository.createWithUris.mockResolvedValue({
      client: {
        id: 'client-uuid',
        clientId: 'byte-forge-web',
        clientSecretHash: null,
        name: 'Byte Forge Web',
        description: null,
        clientType: OAuthClientTypeEnum.PUBLIC,
        grantTypes: ['authorization_code', 'refresh_token'],
        responseTypes: ['code'],
        scopes: ['openid', 'profile', 'email'],
        pkceRequired: true,
        trustedFirstParty: false,
        status: OAuthClientStatusEnum.ACTIVE,
        createdBy: null,
        createdAt,
        updatedAt: createdAt,
      },
      uris: [
        {
          id: 'uri-1',
          oauthClientId: 'client-uuid',
          uri: 'http://localhost:3000/auth/callback',
          kind: OAuthClientUriKindEnum.REDIRECT,
          createdAt,
        },
      ],
    });

    const result = await service.create({
      clientId: 'byte-forge-web',
      name: 'Byte Forge Web',
      clientType: OAuthClientTypeEnum.PUBLIC,
      redirectUris: ['http://localhost:3000/auth/callback'],
    });

    expect(repository.createWithUris).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'byte-forge-web',
        clientType: OAuthClientTypeEnum.PUBLIC,
        pkceRequired: true,
        clientSecretHash: null,
      }),
      expect.arrayContaining([
        expect.objectContaining({
          uri: 'http://localhost:3000/auth/callback',
          kind: OAuthClientUriKindEnum.REDIRECT,
        }),
      ]),
    );
    expect(result.clientSecret).toBeUndefined();
    expect(oidcClientRegistry.invalidate).toHaveBeenCalledWith('byte-forge-web');
  });

  it('rejects confidential clients until secret auth is implemented', async () => {
    repository.findByClientId.mockResolvedValue(null);

    await expect(
      service.create({
        clientId: 'byte-forge-admin',
        name: 'Byte Forge Admin',
        clientType: OAuthClientTypeEnum.CONFIDENTIAL,
        redirectUris: ['https://admin.example.com/auth/callback'],
      }),
    ).rejects.toThrow(/Confidential OAuth clients are not supported/);
    expect(repository.createWithUris).not.toHaveBeenCalled();
  });

  it('rejects duplicate client IDs', async () => {
    repository.findByClientId.mockResolvedValue({
      id: 'existing',
      clientId: 'byte-forge-web',
      clientSecretHash: null,
      name: 'Existing',
      description: null,
      clientType: OAuthClientTypeEnum.PUBLIC,
      grantTypes: [],
      responseTypes: [],
      scopes: [],
      pkceRequired: true,
      trustedFirstParty: false,
      status: OAuthClientStatusEnum.ACTIVE,
      createdBy: null,
      createdAt,
      updatedAt: createdAt,
    });

    await expect(
      service.create({
        clientId: 'byte-forge-web',
        name: 'Byte Forge Web',
        clientType: OAuthClientTypeEnum.PUBLIC,
        redirectUris: ['http://localhost:3000/auth/callback'],
      }),
    ).rejects.toBeInstanceOf(OAuthClientConflictError);
  });

  it('rejects public clients with pkceRequired=false', async () => {
    repository.findByClientId.mockResolvedValue(null);

    await expect(
      service.create({
        clientId: 'byte-forge-web',
        name: 'Byte Forge Web',
        clientType: OAuthClientTypeEnum.PUBLIC,
        redirectUris: ['http://localhost:3000/auth/callback'],
        pkceRequired: false,
      }),
    ).rejects.toThrow('Public clients must require PKCE');
  });

  it('disables an existing client', async () => {
    repository.update.mockResolvedValue({
      id: 'client-uuid',
      clientId: 'byte-forge-web',
      clientSecretHash: null,
      name: 'Byte Forge Web',
      description: null,
      clientType: OAuthClientTypeEnum.PUBLIC,
      grantTypes: [],
      responseTypes: [],
      scopes: [],
      pkceRequired: true,
      trustedFirstParty: false,
      status: OAuthClientStatusEnum.DISABLED,
      createdBy: null,
      createdAt,
      updatedAt: createdAt,
    });

    const result = await service.disable('client-uuid');

    expect(repository.update).toHaveBeenCalledWith('client-uuid', {
      status: OAuthClientStatusEnum.DISABLED,
    });
    expect(result.status).toBe(OAuthClientStatusEnum.DISABLED);
    expect(oidcClientRegistry.invalidate).toHaveBeenCalledWith('byte-forge-web');
  });
});
