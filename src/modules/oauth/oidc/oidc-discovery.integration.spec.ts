import { createServer, type Server } from 'node:http';
import request from 'supertest';
import type { AppEnvService } from '@/libs/config/app-env.service';
import { OidcClientRegistry } from './oidc-client.registry';
import { OidcJwksService } from './oidc-jwks.service';
import { OidcProviderFactory } from './oidc-provider.factory';
import { OIDC_ROUTE_PATHS } from './oidc-routes.constants';

const ISSUER = 'http://localhost:3010';

function createTestAppEnv(): AppEnvService {
  return {
    OIDC_ISSUER: ISSUER,
    OIDC_ACCESS_TOKEN_TTL: 900,
    OIDC_JWKS_PRIVATE_KEY_PATH: '',
    JWT_USER_ACCESS_SECRET: 'dev-only-change-me-user-access-secret-32chars-min',
  } as AppEnvService;
}

describe('OIDC discovery integration', () => {
  let server: Server;
  let agent: ReturnType<typeof request>;

  beforeAll(async () => {
    const appEnv = createTestAppEnv();
    const registry = {
      findPayload: jest.fn().mockResolvedValue(undefined),
    } as unknown as OidcClientRegistry;
    const jwksService = new OidcJwksService(appEnv);
    const factory = new OidcProviderFactory(appEnv, registry, jwksService);
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
