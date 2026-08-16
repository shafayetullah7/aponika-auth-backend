import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { parse as parseUrl } from 'node:url';
import request from 'supertest';
import {
  OAuthClientStatusEnum,
  OAuthClientTypeEnum,
  OAuthClientUriKindEnum,
} from '@/_db/drizzle/enum';
import type { AppEnvService } from '@/libs/config/app-env.service';
import type { IdentityRepository } from '@/modules/identity/identity.repository';
import type { OAuthClientRepository } from '@/modules/oauth/oauth-client.repository';
import type { OAuthConsentRepository } from '@/modules/oauth/oauth-consent.repository';
import { OidcAccountService } from './oidc-account.service';
import { OidcClientRegistry } from './oidc-client.registry';
import { OidcConsentGrantService } from './oidc-consent-grant.service';
import { OidcHostedErrorService } from './oidc-hosted-error.service';
import { OidcInteractionService } from './oidc-interaction.service';
import { OidcLogoutUiService } from './oidc-logout-ui.service';
import { OidcJwksService } from './oidc-jwks.service';
import { OidcProviderFactory } from './oidc-provider.factory';
import { OidcResourceConfigService } from './oidc-resource.config';
import { OidcTokenClaimsService } from './oidc-token-claims.service';
import { OIDC_INTERACTION_PATH_PREFIX, OIDC_ROUTE_PATHS } from './oidc-routes.constants';
import type { OidcUserSessionBridge } from './oidc-user-session.bridge';

const ISSUER = 'http://localhost:3010';
const REDIRECT_URI = 'http://localhost:3000/auth/callback';
const POST_LOGOUT_REDIRECT_URI = 'http://localhost:3000/';
const THIRD_PARTY_REDIRECT_URI = 'http://localhost:4000/auth/callback';
export const TEST_OIDC_RESOURCE = 'http://localhost:3005';

export function createTestAppEnv(
  overrides: Partial<AppEnvService> = {},
): AppEnvService {
  return {
    OIDC_ISSUER: ISSUER,
    OIDC_ACCESS_TOKEN_TTL: 900,
    OIDC_REFRESH_TOKEN_TTL: 604_800,
    OIDC_DEFAULT_RESOURCE: TEST_OIDC_RESOURCE,
    OIDC_JWKS_PRIVATE_KEY_PATH: '',
    JWT_USER_ACCESS_SECRET: 'dev-only-change-me-user-access-secret-32chars-min',
    AUTH_FRONTEND_URL: 'http://localhost:3011',
    SESSION_MAX_AGE: 604800000,
    ...overrides,
  } as AppEnvService;
}

export function createPkcePair() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function seedByteForgeWebClient(registry: OidcClientRegistry): void {
  registry.seedForTest('byte-forge-web', {
    client: {
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
      trustedFirstParty: true,
      status: OAuthClientStatusEnum.ACTIVE,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    uris: [
      {
        id: 'uri-1',
        oauthClientId: 'uuid-1',
        uri: REDIRECT_URI,
        kind: OAuthClientUriKindEnum.REDIRECT,
        createdAt: new Date(),
      },
      {
        id: 'uri-post-logout',
        oauthClientId: 'uuid-1',
        uri: POST_LOGOUT_REDIRECT_URI,
        kind: OAuthClientUriKindEnum.POST_LOGOUT,
        createdAt: new Date(),
      },
    ],
  });
}

export function buildAuthorizeQuery(challenge: string) {
  return {
    client_id: 'byte-forge-web',
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'test-state',
    nonce: 'test-nonce',
  };
}

export function seedThirdPartyClient(registry: OidcClientRegistry): void {
  registry.seedForTest('third-party-app', {
    client: {
      id: 'uuid-2',
      clientId: 'third-party-app',
      clientSecretHash: null,
      name: 'Third Party App',
      description: 'External OAuth client for consent tests',
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
    },
    uris: [
      {
        id: 'uri-2',
        oauthClientId: 'uuid-2',
        uri: THIRD_PARTY_REDIRECT_URI,
        kind: OAuthClientUriKindEnum.REDIRECT,
        createdAt: new Date(),
      },
    ],
  });
}

export function buildThirdPartyAuthorizeQuery(challenge: string) {
  return {
    client_id: 'third-party-app',
    redirect_uri: THIRD_PARTY_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'third-party-state',
    nonce: 'third-party-nonce',
  };
}

export function createDefaultOAuthClientRepositoryMock(): Pick<
  OAuthClientRepository,
  'findByClientId'
> {
  return {
    findByClientId: jest.fn().mockImplementation((clientId: string) => {
      if (clientId === 'byte-forge-web') {
        return Promise.resolve({
          id: 'uuid-1',
          clientId: 'byte-forge-web',
          name: 'Byte Forge Web',
          description: 'test',
          trustedFirstParty: true,
        });
      }

      if (clientId === 'third-party-app') {
        return Promise.resolve({
          id: 'uuid-2',
          clientId: 'third-party-app',
          name: 'Third Party App',
          description: 'External OAuth client for consent tests',
          trustedFirstParty: false,
        });
      }

      return Promise.resolve(null);
    }),
  };
}

export function createDefaultConsentRepositoryMock(): Pick<
  OAuthConsentRepository,
  'findRemembered' | 'upsert'
> {
  return {
    findRemembered: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({
      id: 'consent-1',
      userId: 'user-1',
      oauthClientId: 'uuid-2',
      scopes: ['openid', 'profile', 'email'],
      remember: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  };
}

type CreateOidcTestServerOptions = {
  appEnv?: AppEnvService;
  registry?: OidcClientRegistry;
  sessionBridge: Pick<OidcUserSessionBridge, 'resolveAuthenticatedUser'>;
  identityRepository?: Pick<
    IdentityRepository,
    'findById' | 'findCredentialByUserId'
  >;
  oauthClientRepository?: Pick<OAuthClientRepository, 'findByClientId'>;
  consentRepository?: Pick<OAuthConsentRepository, 'findRemembered' | 'upsert'>;
};

function augmentRequest(req: IncomingMessage, pathname: string): void {
  const expressLike = req as IncomingMessage & {
    path?: string;
    params?: { uid?: string };
  };
  expressLike.path = pathname;
  const uid = pathname.match(/^\/interaction\/([^/]+)/)?.[1];
  if (uid) {
    expressLike.params = { uid };
  }
}

export async function createOidcTestServer(
  options: CreateOidcTestServerOptions,
): Promise<{
  server: Server;
  agent: ReturnType<typeof request.agent>;
  appEnv: AppEnvService;
  registry: OidcClientRegistry;
  interactionService: OidcInteractionService;
  provider: Awaited<ReturnType<OidcProviderFactory['create']>>;
  consentRepository: Pick<OAuthConsentRepository, 'findRemembered' | 'upsert'>;
}> {
  const appEnv = options.appEnv ?? createTestAppEnv();
  const registry = options.registry ?? new OidcClientRegistry({} as never);
  const oauthClientRepository =
    options.oauthClientRepository ?? createDefaultOAuthClientRepositoryMock();
  const consentRepository =
    options.consentRepository ?? createDefaultConsentRepositoryMock();
  const jwksService = new OidcJwksService(appEnv);
  const identityRepository = options.identityRepository ?? {
    findById: jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      status: 'active',
    }),
    findCredentialByUserId: jest.fn().mockResolvedValue({
      emailVerified: true,
    }),
  };
  const accountService = new OidcAccountService(
    identityRepository as IdentityRepository,
  );
  const interactionService = new OidcInteractionService(
    appEnv,
    options.sessionBridge as OidcUserSessionBridge,
    oauthClientRepository as OAuthClientRepository,
    consentRepository as OAuthConsentRepository,
  );
  const consentGrantService = new OidcConsentGrantService(
    consentRepository as OAuthConsentRepository,
    oauthClientRepository as OAuthClientRepository,
    appEnv,
  );
  const resourceConfig = new OidcResourceConfigService(appEnv);
  const tokenClaims = new OidcTokenClaimsService(accountService);
  const hostedErrorService = new OidcHostedErrorService(appEnv);
  const logoutUiService = new OidcLogoutUiService(appEnv);
  const factory = new OidcProviderFactory(
    appEnv,
    registry,
    jwksService,
    accountService,
    interactionService,
    resourceConfig,
    tokenClaims,
    consentGrantService,
    hostedErrorService,
    logoutUiService,
  );
  const provider = await factory.create();
  const oidcHandler = provider.callback();

  const server = createServer((req, res) => {
    req.headers.host = 'localhost:3010';
    const parsed = parseUrl(req.url ?? '/', true);
    const pathname = parsed.pathname ?? '/';
    augmentRequest(req, pathname);

    if (pathname.startsWith(`${OIDC_INTERACTION_PATH_PREFIX}/`)) {
        void interactionService
        .resume(req as never, res as never, provider)
        .catch((error: unknown) => {
          res.statusCode = 500;
          res.end(error instanceof Error ? error.message : 'Interaction error');
        });
      return;
    }

    oidcHandler(req, res, () => {
      res.statusCode = 404;
      res.end('Not found');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));

  const agent = request.agent(server);

  return {
    server,
    agent,
    appEnv,
    registry,
    interactionService,
    provider,
    consentRepository,
  };
}

export async function closeOidcTestServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

export function resolveAuthorizeRedirect(location: string): string {
  if (location.startsWith('/')) {
    return location;
  }

  const url = new URL(location);
  return `${url.pathname}${url.search}`;
}

export async function obtainAuthorizationCode(
  agent: ReturnType<typeof request>,
  challenge: string,
): Promise<string> {
  let res = await agent
    .get(OIDC_ROUTE_PATHS.authorization)
    .query(buildAuthorizeQuery(challenge))
    .redirects(0)
    .expect(303);

  for (let hop = 0; hop < 8; hop += 1) {
    const location = res.headers.location;
    if (!location) {
      break;
    }

    if (location.includes('/auth/callback')) {
      const callbackUrl = new URL(location, ISSUER);
      const code = callbackUrl.searchParams.get('code');
      if (!code) {
        throw new Error('Authorization callback missing code');
      }
      return code;
    }

    res = await agent.get(resolveAuthorizeRedirect(location)).redirects(0);
    expect([302, 303]).toContain(res.status);
  }

  throw new Error(
    `Authorization flow did not complete: last location ${res.headers.location}`,
  );
}

export function exchangeAuthorizationCode(
  agent: ReturnType<typeof request.agent>,
  code: string,
  verifier: string,
) {
  return agent
    .post(OIDC_ROUTE_PATHS.token)
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send(
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: 'byte-forge-web',
        redirect_uri: REDIRECT_URI,
        code,
        code_verifier: verifier,
      }).toString(),
    );
}

export function exchangeRefreshToken(
  agent: ReturnType<typeof request.agent>,
  refreshToken: string,
) {
  return agent
    .post(OIDC_ROUTE_PATHS.token)
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send(
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'byte-forge-web',
        refresh_token: refreshToken,
      }).toString(),
    );
}

export const POST_LOGOUT_URI = POST_LOGOUT_REDIRECT_URI;

export type OidcTokenResponse = {
  id_token: string;
  access_token: string;
  refresh_token?: string;
};

export async function obtainOidcTokens(
  agent: ReturnType<typeof request>,
  challenge: string,
  verifier: string,
): Promise<OidcTokenResponse> {
  const code = await obtainAuthorizationCode(agent, challenge);
  const tokenRes = await exchangeAuthorizationCode(agent, code, verifier).expect(
    200,
  );

  return tokenRes.body as OidcTokenResponse;
}

export function parseEndSessionLogoutForm(html: string): {
  action: string;
  xsrf: string;
} | null {
  const xsrf = html.match(/name="xsrf"\s+value="([^"]+)"/)?.[1];
  const action = html.match(/action="([^"]+)"/)?.[1];
  if (!xsrf || !action) {
    return null;
  }

  return { action, xsrf };
}

export async function completeRpInitiatedLogout(
  agent: ReturnType<typeof request>,
  params: {
    id_token_hint: string;
    post_logout_redirect_uri: string;
    state?: string;
  },
): Promise<string> {
  const initRes = await agent
    .get(OIDC_ROUTE_PATHS.endSession)
    .query(params)
    .expect(200);

  const form = parseEndSessionLogoutForm(initRes.text);
  if (!form) {
    throw new Error('Could not parse end_session logout form');
  }

  const confirmRes = await agent
    .post(resolveAuthorizeRedirect(form.action))
    .type('form')
    .send({ xsrf: form.xsrf, logout: 'yes' })
    .redirects(0)
    .expect(303);

  const location = confirmRes.headers.location;
  if (!location) {
    throw new Error('end_session confirm did not redirect');
  }

  return location;
}
