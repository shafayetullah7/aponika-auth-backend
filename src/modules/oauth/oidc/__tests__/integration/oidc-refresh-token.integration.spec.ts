import { createLocalJWKSet, jwtVerify } from 'jose';
import { OidcClientRegistry } from '../../client/oidc-client.registry';
import {
  closeOidcTestServer,
  createOidcTestServer,
  createPkcePair,
  createTestAppEnv,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  obtainAuthorizationCode,
  seedByteForgeWebClient,
  TEST_OIDC_RESOURCE,
} from '../fixtures/oidc-authorize.test-utils';
import { OIDC_ROUTE_PATHS } from '../../provider/oidc-routes.constants';

describe('OIDC refresh token integration', () => {
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

  async function obtainInitialTokens(
    agent: Awaited<ReturnType<typeof createOidcTestServer>>['agent'],
  ) {
    const code = await obtainAuthorizationCode(agent, challenge);
    const tokenRes = await exchangeAuthorizationCode(agent, code, verifier).expect(
      200,
    );

    return {
      accessToken: tokenRes.body.access_token as string,
      refreshToken: tokenRes.body.refresh_token as string,
      idToken: tokenRes.body.id_token as string,
    };
  }

  it('rotates refresh token and issues a new JWT access token', async () => {
    const registry = new OidcClientRegistry({} as never);
    seedByteForgeWebClient(registry);
    const { server, agent } = await createOidcTestServer({
      sessionBridge: authenticatedSessionBridge,
      identityRepository,
      registry,
    });

    try {
      const initial = await obtainInitialTokens(agent);
      const refreshRes = await exchangeRefreshToken(
        agent,
        initial.refreshToken,
      ).expect(200);

      expect(refreshRes.body.token_type).toBe('Bearer');
      expect(refreshRes.body.access_token).toBeTruthy();
      expect(refreshRes.body.refresh_token).toBeTruthy();
      expect(refreshRes.body.refresh_token).not.toBe(initial.refreshToken);
      expect(refreshRes.body.expires_in).toBe(900);

      const appEnv = createTestAppEnv();
      const jwksRes = await agent.get(OIDC_ROUTE_PATHS.jwks).expect(200);
      const verifyKeys = createLocalJWKSet(jwksRes.body);

      const accessPayload = await jwtVerify(
        refreshRes.body.access_token,
        verifyKeys,
        {
          issuer: appEnv.OIDC_ISSUER,
          audience: TEST_OIDC_RESOURCE,
        },
      );

      expect(accessPayload.payload.sub).toBe('user-1');
      expect(accessPayload.payload.email).toBe('user@example.com');
      expect(accessPayload.payload.email_verified).toBe(true);
    } finally {
      await closeOidcTestServer(server);
    }
  });

  it('rejects reused refresh tokens and revokes the grant family', async () => {
    const registry = new OidcClientRegistry({} as never);
    seedByteForgeWebClient(registry);
    const { server, agent } = await createOidcTestServer({
      sessionBridge: authenticatedSessionBridge,
      identityRepository,
      registry,
    });

    try {
      const initial = await obtainInitialTokens(agent);
      const rotated = await exchangeRefreshToken(
        agent,
        initial.refreshToken,
      ).expect(200);

      const reused = await exchangeRefreshToken(
        agent,
        initial.refreshToken,
      ).expect(400);

      expect(reused.body.error).toBe('invalid_grant');

      const revokedFamily = await exchangeRefreshToken(
        agent,
        rotated.body.refresh_token,
      ).expect(400);

      expect(revokedFamily.body.error).toBe('invalid_grant');
    } finally {
      await closeOidcTestServer(server);
    }
  });
});
