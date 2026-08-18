import { OidcClientRegistry } from '../../client/oidc-client.registry';
import {
  AUTHENTICATED_TEST_USER,
  closeOidcTestServer,
  completeRpInitiatedLogout,
  createAuthenticatedSessionBridge,
  createOidcTestServer,
  createPkcePair,
  obtainOidcTokens,
  POST_LOGOUT_URI,
  seedByteForgeWebClient,
} from '../fixtures/oidc-authorize.test-utils';
import { OIDC_ROUTE_PATHS } from '../../provider/oidc-routes.constants';
import type { CookieService } from '@/libs/cookie/cookie.service';

function createNodeCompatibleCookieService(): CookieService {
  return {
    clearUserTokens: jest.fn((res: { setHeader: (name: string, value: string[]) => void }) => {
      res.setHeader('Set-Cookie', [
        'userAccessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'userRefreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'user-xsrf-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      ]);
    }),
  } as unknown as CookieService;
}

describe('OIDC end_session integration', () => {
  const { challenge, verifier } = createPkcePair();

  it('redirects to registered post_logout_redirect_uri with state', async () => {
    const registry = new OidcClientRegistry({} as never);
    seedByteForgeWebClient(registry);
    const { server, agent } = await createOidcTestServer({
      sessionBridge: createAuthenticatedSessionBridge(),
      registry,
    });

    try {
      const tokens = await obtainOidcTokens(agent, challenge, verifier);
      const { redirectUrl } = await completeRpInitiatedLogout(agent, {
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

  it('destroys the SSO session cookie when the logout page auto-submits', async () => {
    const registry = new OidcClientRegistry({} as never);
    seedByteForgeWebClient(registry);
    const { server, agent } = await createOidcTestServer({
      sessionBridge: createAuthenticatedSessionBridge(),
      registry,
    });

    try {
      const tokens = await obtainOidcTokens(agent, challenge, verifier);
      const { setCookie } = await completeRpInitiatedLogout(agent, {
        id_token_hint: tokens.id_token,
        post_logout_redirect_uri: POST_LOGOUT_URI,
      });

      expect(setCookie).toEqual(
        expect.arrayContaining([expect.stringMatching(/^_session=;/)]),
      );
    } finally {
      await closeOidcTestServer(server);
    }
  });

  it('revokes hosted sessions and clears cookies via end_session listener', async () => {
    const logoutAllActiveSessions = jest.fn().mockResolvedValue(undefined);
    const cookieService = createNodeCompatibleCookieService();
    const registry = new OidcClientRegistry({} as never);
    seedByteForgeWebClient(registry);

    const { server, agent, endSession } = await createOidcTestServer({
      sessionBridge: createAuthenticatedSessionBridge(),
      registry,
      endSession: {
        userAuthService: { logoutAllActiveSessions },
        cookieService,
      },
    });

    try {
      const tokens = await obtainOidcTokens(agent, challenge, verifier);
      const { setCookie } = await completeRpInitiatedLogout(agent, {
        id_token_hint: tokens.id_token,
        post_logout_redirect_uri: POST_LOGOUT_URI,
      });

      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      expect(endSession).toBeDefined();
      expect(logoutAllActiveSessions).toHaveBeenCalledWith(
        AUTHENTICATED_TEST_USER.user.id,
        expect.any(String),
      );
      expect(cookieService.clearUserTokens).toHaveBeenCalled();

      expect(setCookie).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^userAccessToken=;/),
          expect.stringMatching(/^userRefreshToken=;/),
          expect.stringMatching(/^user-xsrf-token=;/),
        ]),
      );
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
