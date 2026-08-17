import { createServer, type Server } from 'node:http';
import request from 'supertest';
import type { IdentityRepository } from '@/modules/identity/identity.repository';
import { OidcAccountService } from '../../login/oidc-account.service';
import { OidcClientRegistry } from '../../client/oidc-client.registry';
import { OidcConsentGrantService } from '../../consent/oidc-consent-grant.service';
import { OidcHostedErrorService } from '../../login/oidc-hosted-error.service';
import { OidcInteractionService } from '../../login/oidc-interaction.service';
import { OidcLogoutUiService } from '../../logout/oidc-logout-ui.service';
import { OidcJwksService } from '../../boot/oidc-jwks.service';
import { OidcProviderFactory } from '../../provider/oidc-provider.factory';
import { OidcResourceConfigService } from '../../token/oidc-resource.config';
import { OidcTokenClaimsService } from '../../token/oidc-token-claims.service';
import { OIDC_ROUTE_PATHS } from '../../provider/oidc-routes.constants';
import {
  createDefaultConsentRepositoryMock,
  createDefaultOAuthClientRepositoryMock,
  createTestAppEnv,
} from '../fixtures/oidc-authorize.test-utils';

const ISSUER = 'http://localhost:3010';

describe('OIDC discovery integration', () => {
  let server: Server;
  let agent: ReturnType<typeof request>;

  beforeAll(async () => {
    const appEnv = createTestAppEnv();
    const registry = {
      findPayload: jest.fn().mockResolvedValue(undefined),
    } as unknown as OidcClientRegistry;
    const jwksService = new OidcJwksService(appEnv);
    const identityRepository = {
      findById: jest.fn(),
      findCredentialByUserId: jest.fn(),
    } as unknown as IdentityRepository;
    const accountService = new OidcAccountService(identityRepository);
    const resourceConfig = new OidcResourceConfigService(appEnv);
    const tokenClaims = new OidcTokenClaimsService(accountService);
    const interactionService = new OidcInteractionService(
      appEnv,
      {
        resolveAuthenticatedUser: jest.fn(),
      } as never,
      createDefaultOAuthClientRepositoryMock() as never,
      createDefaultConsentRepositoryMock() as never,
    );
    const consentGrantService = new OidcConsentGrantService(
      createDefaultConsentRepositoryMock() as never,
      createDefaultOAuthClientRepositoryMock() as never,
      appEnv,
    );
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

    server = createServer(provider.callback());
    await new Promise<void>((resolve) => server.listen(0, resolve));
    agent = request(server);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('GET /.well-known/openid-configuration returns issuer metadata', async () => {
    const res = await agent
      .get(OIDC_ROUTE_PATHS.openidConfiguration)
      .expect(200);

    expect(res.body.issuer).toBe(ISSUER);
    expect(res.body.jwks_uri).toMatch(/\/jwks$/);
    expect(res.body.authorization_endpoint).toMatch(/\/auth$/);
    expect(res.body.token_endpoint).toMatch(/\/token$/);
    expect(res.body.code_challenge_methods_supported).toContain('S256');
    expect(res.body.grant_types_supported).toContain('refresh_token');
    expect(res.body.end_session_endpoint).toMatch(/\/session\/end$/);
  });

  it('GET /jwks returns public signing keys only', async () => {
    const res = await agent.get(OIDC_ROUTE_PATHS.jwks).expect(200);

    expect(Array.isArray(res.body.keys)).toBe(true);
    expect(res.body.keys.length).toBeGreaterThan(0);
    expect(res.body.keys[0]).toMatchObject({
      kty: 'RSA',
      use: 'sig',
      alg: 'RS256',
    });
    expect(res.body.keys[0].d).toBeUndefined();
  });
});
