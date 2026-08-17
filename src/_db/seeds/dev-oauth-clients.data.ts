import {
  OAuthClientStatusEnum,
  OAuthClientTypeEnum,
  OAuthClientUriKindEnum,
} from '@/_db/drizzle/enum';

export type DevOAuthClientSeed = {
  clientId: string;
  name: string;
  description: string;
  clientType: (typeof OAuthClientTypeEnum)[keyof typeof OAuthClientTypeEnum];
  trustedFirstParty?: boolean;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  allowedOrigins: string[];
};

export const DEFAULT_OAUTH_GRANT_TYPES = ['authorization_code', 'refresh_token'];
export const DEFAULT_OAUTH_RESPONSE_TYPES = ['code'];
export const DEFAULT_OAUTH_SCOPES = ['openid', 'profile', 'email'];

/**
 * Local dev OAuth clients — keep in sync with docs/INTEGRATION.md § Local dev clients.
 */
export const DEV_OAUTH_CLIENTS: DevOAuthClientSeed[] = [
  {
    clientId: 'byte-forge-web',
    name: 'Byte Forge Web',
    description: 'Byte Forge marketplace web app',
    clientType: OAuthClientTypeEnum.PUBLIC,
    trustedFirstParty: true,
    redirectUris: [
      'http://localhost:3005/api/v1/user/auth/oidc/callback',
      'http://localhost:3000/auth/callback',
    ],
    postLogoutRedirectUris: ['http://localhost:3000/'],
    allowedOrigins: ['http://localhost:3000', 'http://localhost:3005'],
  },
  {
    clientId: 'byte-forge-admin',
    name: 'Byte Forge Admin',
    description: 'Byte Forge marketplace operator console',
    clientType: OAuthClientTypeEnum.PUBLIC,
    trustedFirstParty: true,
    redirectUris: ['http://localhost:3050/auth/callback'],
    postLogoutRedirectUris: ['http://localhost:3050/'],
    allowedOrigins: ['http://localhost:3050'],
  },
  {
    clientId: 'aponika-auth-admin',
    name: 'Aponika Auth Admin',
    description: 'Aponika identity platform operator console',
    clientType: OAuthClientTypeEnum.PUBLIC,
    trustedFirstParty: true,
    redirectUris: ['http://localhost:3012/auth/callback'],
    postLogoutRedirectUris: ['http://localhost:3012/'],
    allowedOrigins: ['http://localhost:3012'],
  },
];

export function toUriRows(bundle: {
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  allowedOrigins: string[];
}) {
  return [
    ...bundle.redirectUris.map((uri) => ({
      uri,
      kind: OAuthClientUriKindEnum.REDIRECT,
    })),
    ...bundle.postLogoutRedirectUris.map((uri) => ({
      uri,
      kind: OAuthClientUriKindEnum.POST_LOGOUT,
    })),
    ...bundle.allowedOrigins.map((uri) => ({
      uri,
      kind: OAuthClientUriKindEnum.ALLOWED_ORIGIN,
    })),
  ];
}

export const DEV_OAUTH_CLIENT_DEFAULTS = {
  grantTypes: DEFAULT_OAUTH_GRANT_TYPES,
  responseTypes: DEFAULT_OAUTH_RESPONSE_TYPES,
  scopes: DEFAULT_OAUTH_SCOPES,
  pkceRequired: true,
  status: OAuthClientStatusEnum.ACTIVE,
};
