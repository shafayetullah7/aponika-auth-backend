import { OidcClientRegistry } from '../../client/oidc-client.registry';
import {
  buildAuthorizeQuery,
  closeOidcTestServer,
  createAuthenticatedSessionBridge,
  createDeferredAuthSessionBridge,
  createDefaultIdentityRepositoryMock,
  createOidcTestServer,
  createPkcePair,
  createUnauthenticatedSessionBridge,
  followOidcRedirectsUntil,
  seedByteForgeWebClient,
} from '../fixtures/oidc-authorize.test-utils';
import { OIDC_ROUTE_PATHS } from '../../provider/oidc-routes.constants';

describe('OIDC interaction resume integration', () => {
  const identityRepository = createDefaultIdentityRepositoryMock();

  describe('login-during-OIDC round trip', () => {
    it('completes authorize after unauthenticated user logs in', async () => {
      const { challenge } = createPkcePair();
      const sessionBridge = createDeferredAuthSessionBridge();
      const registry = new OidcClientRegistry({} as never);
      seedByteForgeWebClient(registry);
      const { server, agent } = await createOidcTestServer({
        sessionBridge,
        identityRepository,
        registry,
      });

      try {
        const authRes = await agent
          .get(OIDC_ROUTE_PATHS.authorization)
          .query(buildAuthorizeQuery(challenge))
          .redirects(0)
          .expect(303);

        const interactionPath = authRes.headers.location!;
        expect(interactionPath).toMatch(/^\/interaction\/[a-zA-Z0-9_-]+$/);

        const loginRes = await agent
          .get(interactionPath)
          .redirects(0)
          .expect(302);

        const loginUrl = new URL(loginRes.headers.location!);
        expect(loginUrl.origin).toBe('http://localhost:3011');
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('returnTo')).toBe(
          `http://localhost:3010${interactionPath}`,
        );

        sessionBridge.markAuthenticated();

        const resumeRes = await agent.get(interactionPath).redirects(0);
        const { location } = await followOidcRedirectsUntil(
          agent,
          resumeRes,
          (nextLocation) => nextLocation.includes('/auth/callback'),
        );

        const callbackUrl = new URL(location, 'http://localhost:3010');
        expect(callbackUrl.origin).toBe('http://localhost:3000');
        expect(callbackUrl.pathname).toBe('/auth/callback');
        expect(callbackUrl.searchParams.get('code')).toBeTruthy();
        expect(callbackUrl.searchParams.get('state')).toBe('test-state');
      } finally {
        await closeOidcTestServer(server);
      }
    });
  });

  describe('stale or missing interaction', () => {
    it('redirects to hosted error when interaction is lost after server restart', async () => {
      const { challenge } = createPkcePair();
      const sessionBridge = createDeferredAuthSessionBridge();
      const registry = new OidcClientRegistry({} as never);
      seedByteForgeWebClient(registry);
      const { server, agent } = await createOidcTestServer({
        sessionBridge,
        identityRepository,
        registry,
      });

      let interactionPath = '';

      try {
        const authRes = await agent
          .get(OIDC_ROUTE_PATHS.authorization)
          .query(buildAuthorizeQuery(challenge))
          .redirects(0)
          .expect(303);

        interactionPath = authRes.headers.location!;
        await agent.get(interactionPath).redirects(0).expect(302);
        sessionBridge.markAuthenticated();
      } finally {
        await closeOidcTestServer(server);
      }

      const restartedRegistry = new OidcClientRegistry({} as never);
      seedByteForgeWebClient(restartedRegistry);
      const { server: restartedServer, agent: restartedAgent } =
        await createOidcTestServer({
          sessionBridge: createAuthenticatedSessionBridge(),
          identityRepository,
          registry: restartedRegistry,
        });

      try {
        const res = await restartedAgent
          .get(interactionPath)
          .redirects(0)
          .expect(303);

        const errorUrl = new URL(res.headers.location!);
        expect(errorUrl.origin).toBe('http://localhost:3011');
        expect(errorUrl.pathname).toBe('/oauth/error');
        expect(errorUrl.searchParams.get('error')).toBe('interaction_expired');
      } finally {
        await closeOidcTestServer(restartedServer);
      }
    });

    it('redirects to hosted error for missing interaction uid', async () => {
      const registry = new OidcClientRegistry({} as never);
      seedByteForgeWebClient(registry);
      const { server, agent } = await createOidcTestServer({
        sessionBridge: createUnauthenticatedSessionBridge(),
        registry,
      });

      try {
        const res = await agent.get('/interaction/').redirects(0).expect(303);

        const errorUrl = new URL(res.headers.location!);
        expect(errorUrl.origin).toBe('http://localhost:3011');
        expect(errorUrl.pathname).toBe('/oauth/error');
        expect(errorUrl.searchParams.get('error')).toBe('invalid_request');
      } finally {
        await closeOidcTestServer(server);
      }
    });

    it('redirects authenticated resume failures to hosted error', async () => {
      const registry = new OidcClientRegistry({} as never);
      seedByteForgeWebClient(registry);
      const { server, agent } = await createOidcTestServer({
        sessionBridge: createAuthenticatedSessionBridge(),
        identityRepository,
        registry,
      });

      try {
        const res = await agent
          .get('/interaction/unknown-interaction-uid')
          .redirects(0)
          .expect(303);

        const errorUrl = new URL(res.headers.location!);
        expect(errorUrl.origin).toBe('http://localhost:3011');
        expect(errorUrl.pathname).toBe('/oauth/error');
        expect(errorUrl.searchParams.get('error')).toBe('interaction_expired');
      } finally {
        await closeOidcTestServer(server);
      }
    });
  });
});
