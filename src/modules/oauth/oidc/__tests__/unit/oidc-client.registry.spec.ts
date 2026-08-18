import {
  OAuthClientStatusEnum,
  OAuthClientTypeEnum,
} from '@/_db/drizzle/enum';
import { OidcClientRegistry } from '../../client/oidc-client.registry';

describe('OidcClientRegistry', () => {
  const bundle = {
    client: {
      id: 'uuid-1',
      clientId: 'byte-forge-web',
      clientSecretHash: null,
      name: 'Byte Forge Web',
      description: null,
      clientType: OAuthClientTypeEnum.PUBLIC,
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      scopes: ['openid'],
      pkceRequired: true,
      trustedFirstParty: true,
      status: OAuthClientStatusEnum.ACTIVE,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    uris: [],
  };

  it('returns undefined immediately after invalidate of a cached client', async () => {
    const repository = {
      findByClientIdWithUris: jest.fn().mockResolvedValue({
        ...bundle,
        client: { ...bundle.client, status: OAuthClientStatusEnum.DISABLED },
      }),
    };
    const registry = new OidcClientRegistry(repository as never);
    registry.seedForTest('byte-forge-web', bundle);

    expect(await registry.findPayload('byte-forge-web')).toMatchObject({
      client_id: 'byte-forge-web',
    });

    registry.invalidate('byte-forge-web');

    expect(await registry.findPayload('byte-forge-web')).toBeUndefined();
    expect(repository.findByClientIdWithUris).toHaveBeenCalledWith(
      'byte-forge-web',
    );
  });
});
