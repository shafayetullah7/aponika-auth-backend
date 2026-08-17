import { OidcClientRegistry } from '../../oidc-client.registry';
import {
  buildAuthorizeQuery,
  closeOidcTestServer,
  completeRpInitiatedLogout,
  createOidcTestServer,
  createPkcePair,
  obtainOidcTokens,
  POST_LOGOUT_URI,
  seedByteForgeWebClient,
} from '../fixtures/oidc-authorize.test-utils';
import { OIDC_ROUTE_PATHS } from '../../oidc-routes.constants';

describe('OIDC end_session integration', () => {
  const { challenge, verifier } = createPkcePair();

  it('redirects to registered post_logout_redirect_uri with state', async () => {
    const sessionBridge = {
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
    const registry = new OidcClientRegistry({} as never);
    seedByteForgeWebClient(registry);
    const { server, agent } = await createOidcTestServer({
      sessionBridge,
      identityRepository,
      registry,
    });

    try {
      const tokens = await obtainOidcTokens(agent, challenge, verifier);
      const redirectUrl = await completeRpInitiatedLogout(agent, {
        id_token_hint: tokens.id_token,
        post_logout_redirect_uri: POST_LOGOUT_URI,
        state: 'logout-state',
      });

      const parsed = new URL(redirectUrl);
      expect(parsed.origin).toBe('http://localhost:3000');
      expect(parsed.pathname).toBe('/');
      expect(parsed.searchParams.get('state')).toBe('logout-state');
    } finally {
      await closeOidcTestServer(server);
    }
  });

  it('advertises end_session in discovery metadata', async () => {
    const { server, agent } = await createOidcTestServer({
      sessionBridge: {
        resolveAuthenticatedUser: jest.fn().mockResolvedValue(null),
      },
    });

    try {
      const res = await agent
        .get(OIDC_ROUTE_PATHS.openidConfiguration)
        .expect(200);

      expect(res.body.end_session_endpoint).toMatch(/\/session\/end$/);
    } finally {
      await closeOidcTestServer(server);
    }
  });
});
