import { OidcClientRegistry } from '../../client/oidc-client.registry';
import {
  buildThirdPartyAuthorizeQuery,
  closeOidcTestServer,
  createOidcTestServer,
  createPkcePair,
  resolveAuthorizeRedirect,
  seedThirdPartyClient,
} from '../fixtures/oidc-authorize.test-utils';
import { OIDC_ROUTE_PATHS } from '../../provider/oidc-routes.constants';

describe('OIDC consent integration', () => {
  const { challenge } = createPkcePair();

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

  it('redirects third-party clients to the hosted consent screen', async () => {
    const registry = new OidcClientRegistry({} as never);
    seedThirdPartyClient(registry);
    const { server, agent } = await createOidcTestServer({
      sessionBridge: authenticatedSessionBridge,
      identityRepository,
      registry,
    });

    try {
      let res = await agent
        .get(OIDC_ROUTE_PATHS.authorization)
        .query(buildThirdPartyAuthorizeQuery(challenge))
        .redirects(0)
        .expect(303);

      for (let hop = 0; hop < 8; hop += 1) {
        const location = res.headers.location;
        if (!location) {
          break;
        }

        if (location.includes('/consent')) {
          const consentUrl = new URL(location);
          expect(consentUrl.origin).toBe('http://localhost:3011');
          expect(consentUrl.pathname).toBe('/consent');
          expect(consentUrl.searchParams.get('returnTo')).toMatch(
            /^http:\/\/localhost:3010\/interaction\//,
          );
          return;
        }

        res = await agent.get(resolveAuthorizeRedirect(location)).redirects(0);
        expect([302, 303]).toContain(res.status);
      }

      throw new Error(
        `Consent redirect not reached: last location ${res.headers.location}`,
      );
    } finally {
      await closeOidcTestServer(server);
    }
  });

  it('skips consent when remembered scopes cover the request', async () => {
    const registry = new OidcClientRegistry({} as never);
    seedThirdPartyClient(registry);
    const consentRepository = {
      findRemembered: jest.fn().mockResolvedValue({
        id: 'consent-1',
        userId: 'user-1',
        oauthClientId: 'uuid-2',
        scopes: ['openid', 'profile', 'email'],
        remember: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      upsert: jest.fn(),
    };

    const { server, agent } = await createOidcTestServer({
      sessionBridge: authenticatedSessionBridge,
      identityRepository,
      registry,
      consentRepository,
    });

    try {
      let res = await agent
        .get(OIDC_ROUTE_PATHS.authorization)
        .query(buildThirdPartyAuthorizeQuery(challenge))
        .redirects(0)
        .expect(303);

      for (let hop = 0; hop < 8; hop += 1) {
        const location = res.headers.location;
        if (!location) {
          break;
        }

        if (location.includes('/auth/callback')) {
          const callbackUrl = new URL(location);
          expect(callbackUrl.searchParams.get('code')).toBeTruthy();
          expect(callbackUrl.searchParams.get('state')).toBe('third-party-state');
          return;
        }

        expect(location).not.toContain('/consent');
        res = await agent.get(resolveAuthorizeRedirect(location)).redirects(0);
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
