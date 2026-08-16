/**
 * Minimal shapes for oidc-provider events we subscribe to.
 * The library does not ship TypeScript types for Koa ctx payloads.
 */

export type OidcGrantSuccessContext = {
  oidc: {
    params: { grant_type?: string };
    client?: { clientId: string };
    entities?: {
      AccessToken?: { accountId?: string };
    };
  };
  ip?: string;
};

export type OidcProviderEventMap = {
  'grant.success': OidcGrantSuccessContext;
};

export function isOidcGrantSuccessContext(
  ctx: unknown,
): ctx is OidcGrantSuccessContext {
  if (!ctx || typeof ctx !== 'object') {
    return false;
  }

  const oidc = Reflect.get(ctx, 'oidc');
  if (!oidc || typeof oidc !== 'object') {
    return false;
  }

  const params = Reflect.get(oidc, 'params');
  return params !== null && typeof params === 'object';
}
