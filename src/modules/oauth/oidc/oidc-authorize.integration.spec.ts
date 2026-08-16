import { OidcClientRegistry } from './oidc-client.registry';
import {
  buildAuthorizeQuery,
  closeOidcTestServer,
  createOidcTestServer,
  createPkcePair,
  resolveAuthorizeRedirect,
  seedByteForgeWebClient,
} from './oidc-authorize.test-utils';
import { OIDC_ROUTE_PATHS } from './oidc-routes.constants';

describe('OIDC authorize integration', () => {
  const { challenge } = createPkcePair();

  describe('unauthenticated user', () => {
    it('redirects to auth frontend login with interaction resume returnTo', async () => {
      const sessionBridge = {
        resolveAuthenticatedUser: jest.fn().mockResolvedValue(null),
      };
      const { server, agent, registry } = await createOidcTestServer({
        sessionBridge,
      });
      seedByteForgeWebClient(registry);

      try {
        const authRes = await agent
          .get(OIDC_ROUTE_PATHS.authorization)
          .query(buildAuthorizeQuery(challenge))
          .expect(303);

        expect(authRes.headers.location).toMatch(
          /^\/interaction\/[a-zA-Z0-9_-]+$/,
        );

        const interactionRes = await agent
          .get(authRes.headers.location!)
          .expect(302);

        const loginUrl = new URL(interactionRes.headers.location!);
        expect(loginUrl.origin).toBe('http://localhost:3011');
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('returnTo')).toMatch(
          /^http:\/\/localhost:3010\/interaction\//,
        );
      } finally {
        await closeOidcTestServer(server);
      }
    });
  });

  describe('authenticated user', () => {
    it('redirects to client callback with authorization code', async () => {
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
            const callbackUrl = new URL(location);
            expect(callbackUrl.origin).toBe('http://localhost:3000');
            expect(callbackUrl.pathname).toBe('/auth/callback');
            expect(callbackUrl.searchParams.get('code')).toBeTruthy();
            expect(callbackUrl.searchParams.get('state')).toBe('test-state');
            return;
          }

          res = await agent
            .get(resolveAuthorizeRedirect(location))
            .redirects(0);
          expect([302, 303]).toContain(res.status);
        }

        throw new Error(
          `Authorization flow did not complete: last location ${res.headers.location}`,
        );
      } finally {
        await closeOidcTestServer(server);
      }
    });
  });

  describe('validation errors', () => {
    it('redirects to hosted error page for invalid redirect_uri', async () => {
      const sessionBridge = {
        resolveAuthenticatedUser: jest.fn().mockResolvedValue(null),
      };
      const { server, agent, registry } = await createOidcTestServer({
        sessionBridge,
      });
      seedByteForgeWebClient(registry);

      try {
        const res = await agent
          .get(OIDC_ROUTE_PATHS.authorization)
          .query({
            ...buildAuthorizeQuery(challenge),
            redirect_uri: 'http://evil.example/callback',
          })
          .redirects(0)
          .expect(303);

        const errorUrl = new URL(res.headers.location!);
        expect(errorUrl.origin).toBe('http://localhost:3011');
        expect(errorUrl.pathname).toBe('/oauth/error');
        expect(errorUrl.searchParams.get('error')).toBeTruthy();
        expect(errorUrl.searchParams.get('state')).toBe('test-state');
      } finally {
        await closeOidcTestServer(server);
      }
    });
  });
});
