/**
 * oidc-provider route paths (defaults).
 * Discovery advertises full URLs as `{OIDC_ISSUER}{path}`.
 */
export const OIDC_ROUTE_PATHS = {
  authorization: '/auth',
  token: '/token',
  jwks: '/jwks',
  userinfo: '/me',
  registration: '/reg',
  revocation: '/token/revocation',
  introspection: '/token/introspection',
  endSession: '/session/end',
  interaction: '/interaction',
  openidConfiguration: '/.well-known/openid-configuration',
  oauthAuthorizationServer: '/.well-known/oauth-authorization-server',
} as const;

export const OIDC_INTERACTION_PATH_PREFIX = OIDC_ROUTE_PATHS.interaction;

/** Routes passed to oidc-provider `configuration.routes`. */
export const OIDC_PROVIDER_ROUTES = {
  authorization: OIDC_ROUTE_PATHS.authorization,
  token: OIDC_ROUTE_PATHS.token,
  jwks: OIDC_ROUTE_PATHS.jwks,
  userinfo: OIDC_ROUTE_PATHS.userinfo,
  registration: OIDC_ROUTE_PATHS.registration,
  revocation: OIDC_ROUTE_PATHS.revocation,
  introspection: OIDC_ROUTE_PATHS.introspection,
  end_session: OIDC_ROUTE_PATHS.endSession,
} as const;

/** Paths mounted outside the `/api` global prefix (issuer root). */
export const OIDC_GLOBAL_PREFIX_EXCLUSIONS = [
  'health',
  OIDC_ROUTE_PATHS.openidConfiguration.slice(1),
  OIDC_ROUTE_PATHS.oauthAuthorizationServer.slice(1),
  OIDC_ROUTE_PATHS.jwks.slice(1),
  OIDC_ROUTE_PATHS.authorization.slice(1),
  OIDC_ROUTE_PATHS.token.slice(1),
  OIDC_ROUTE_PATHS.userinfo.slice(1),
  OIDC_ROUTE_PATHS.registration.slice(1),
  OIDC_ROUTE_PATHS.revocation.slice(1),
  OIDC_ROUTE_PATHS.introspection.slice(1),
  OIDC_ROUTE_PATHS.endSession.slice(1),
  OIDC_ROUTE_PATHS.interaction.slice(1),
  'device',
  'request',
  'challenge',
  'credential',
  'backchannel',
] as const;

export const OIDC_HTTP_PREFIXES = [
  '/.well-known',
  OIDC_ROUTE_PATHS.authorization,
  OIDC_ROUTE_PATHS.token,
  OIDC_ROUTE_PATHS.registration,
  OIDC_ROUTE_PATHS.userinfo,
  OIDC_ROUTE_PATHS.jwks,
  '/device',
  OIDC_ROUTE_PATHS.revocation,
  OIDC_ROUTE_PATHS.introspection,
  OIDC_ROUTE_PATHS.endSession,
] as const;

export function isOidcHttpPath(path: string): boolean {
  return OIDC_HTTP_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function buildOidcIssuerUrl(issuer: string, path: string): string {
  const base = issuer.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
