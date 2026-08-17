import { createLocalJWKSet, jwtVerify } from 'jose';
import { OidcClientRegistry } from '../../oidc-client.registry';
import {
  closeOidcTestServer,
  createOidcTestServer,
  createPkcePair,
  exchangeAuthorizationCode,
  obtainAuthorizationCode,
  seedByteForgeWebClient,
  TEST_OIDC_RESOURCE,
} from '../fixtures/oidc-authorize.test-utils';
import { OIDC_ROUTE_PATHS } from '../../oidc-routes.constants';
import { createTestAppEnv } from '../fixtures/oidc-authorize.test-utils';

describe('OIDC token integration', () => {
  const { verifier, challenge } = createPkcePair();

  const authenticatedSessionBridge = {
    resolveAuthenticatedUser: jest.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        status: 'active',
      },
      credential: { emailVerified: true },
      profile: null,
      session: { id: 'session-1' },
    }),
  };

  const identityRepository = {
    findById: jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      status: 'active',
    }),
    findCredentialByUserId: jest.fn().mockResolvedValue({
      emailVerified: true,
    }),
  };

  it('exchanges authorization code for JWT access token, id_token, and refresh_token', async () => {
    const registry = new OidcClientRegistry({} as never);
    seedByteForgeWebClient(registry);
    const { server, agent } = await createOidcTestServer({
      sessionBridge: authenticatedSessionBridge,
      identityRepository,
      registry,
    });

    try {
      const code = await obtainAuthorizationCode(agent, challenge);
      const tokenRes = await exchangeAuthorizationCode(agent, code, verifier).expect(
        200,
      );

      expect(tokenRes.body.token_type).toBe('Bearer');
      expect(tokenRes.body.access_token).toBeTruthy();
      expect(tokenRes.body.id_token).toBeTruthy();
      expect(tokenRes.body.refresh_token).toBeTruthy();
      expect(tokenRes.body.expires_in).toBe(900);

      const appEnv = createTestAppEnv();
      const jwksRes = await agent.get(OIDC_ROUTE_PATHS.jwks).expect(200);
      const verifyKeys = createLocalJWKSet(jwksRes.body);

      const accessPayload = await jwtVerify(tokenRes.body.access_token, verifyKeys, {
        issuer: appEnv.OIDC_ISSUER,
        audience: TEST_OIDC_RESOURCE,
      });

      expect(accessPayload.payload.sub).toBe('user-1');
      expect(accessPayload.payload.email).toBe('user@example.com');
      expect(accessPayload.payload.email_verified).toBe(true);

      const idPayload = await jwtVerify(tokenRes.body.id_token, verifyKeys, {
        issuer: appEnv.OIDC_ISSUER,
        audience: 'byte-forge-web',
      });

      expect(idPayload.payload.sub).toBe('user-1');
      expect(idPayload.payload.email).toBe('user@example.com');
      expect(idPayload.payload.email_verified).toBe(true);
    } finally {
      await closeOidcTestServer(server);
    }
  });

  it('rejects reused authorization codes', async () => {
    const registry = new OidcClientRegistry({} as never);
    seedByteForgeWebClient(registry);
    const { server, agent } = await createOidcTestServer({
      sessionBridge: authenticatedSessionBridge,
      identityRepository,
      registry,
    });

    try {
      const code = await obtainAuthorizationCode(agent, challenge);
      await exchangeAuthorizationCode(agent, code, verifier).expect(200);

      const reused = await exchangeAuthorizationCode(agent, code, verifier).expect(
        400,
      );

      expect(reused.body.error).toBe('invalid_grant');
    } finally {
      await closeOidcTestServer(server);
    }
  });

  it('rejects token exchange with invalid code_verifier', async () => {
    const registry = new OidcClientRegistry({} as never);
    seedByteForgeWebClient(registry);
    const { server, agent } = await createOidcTestServer({
      sessionBridge: authenticatedSessionBridge,
      identityRepository,
      registry,
    });

    try {
      const code = await obtainAuthorizationCode(agent, challenge);
      const badVerifier = createPkcePair().verifier;

      const res = await exchangeAuthorizationCode(agent, code, badVerifier).expect(
        400,
      );

      expect(res.body.error).toBe('invalid_grant');
    } finally {
      await closeOidcTestServer(server);
    }
  });
});
