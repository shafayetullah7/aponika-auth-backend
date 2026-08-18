import {
  OAuthClientStatusEnum,
  OAuthClientTypeEnum,
  OAuthClientUriKindEnum,
} from '@/_db/drizzle/enum';
import { mapOAuthClientToOidcPayload } from '../../client/oidc-client.mapper';

describe('mapOAuthClientToOidcPayload', () => {
  const baseClient = {
    id: 'uuid-1',
    clientId: 'byte-forge-web',
    clientSecretHash: null,
    name: 'Byte Forge Web',
    description: 'test',
    clientType: OAuthClientTypeEnum.PUBLIC,
    grantTypes: ['authorization_code', 'refresh_token'],
    responseTypes: ['code'],
    scopes: ['openid', 'profile', 'email'],
    pkceRequired: true,
    trustedFirstParty: false,
    status: OAuthClientStatusEnum.ACTIVE,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('maps an active public client with redirect URIs', () => {
    const payload = mapOAuthClientToOidcPayload({
      client: baseClient,
      uris: [
        {
          id: 'uri-1',
          oauthClientId: baseClient.id,
          uri: 'http://localhost:3000/auth/callback',
          kind: OAuthClientUriKindEnum.REDIRECT,
          createdAt: new Date(),
        },
        {
          id: 'uri-2',
          oauthClientId: baseClient.id,
          uri: 'http://localhost:3000/',
          kind: OAuthClientUriKindEnum.POST_LOGOUT,
          createdAt: new Date(),
        },
      ],
    });

    expect(payload).toEqual({
      client_id: 'byte-forge-web',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      redirect_uris: ['http://localhost:3000/auth/callback'],
      post_logout_redirect_uris: ['http://localhost:3000/'],
      token_endpoint_auth_method: 'none',
      scope: 'openid profile email offline_access',
      application_type: 'web',
    });
  });

  it('returns undefined for disabled clients', () => {
    const payload = mapOAuthClientToOidcPayload({
      client: { ...baseClient, status: OAuthClientStatusEnum.DISABLED },
      uris: [],
    });

    expect(payload).toBeUndefined();
  });

  it('returns undefined for confidential clients (secret auth not implemented)', () => {
    const payload = mapOAuthClientToOidcPayload({
      client: { ...baseClient, clientType: OAuthClientTypeEnum.CONFIDENTIAL },
      uris: [
        {
          id: 'uri-1',
          oauthClientId: baseClient.id,
          uri: 'http://localhost:3000/auth/callback',
          kind: OAuthClientUriKindEnum.REDIRECT,
          createdAt: new Date(),
        },
      ],
    });

    expect(payload).toBeUndefined();
  });
});
