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
  'end_session.success': OidcEndSessionSuccessContext;
};

export type OidcEndSessionSuccessContext = {
  ip?: string;
  oidc?: {
    session?: { accountId?: string };
    entities?: {
      IdTokenHint?: {
        payload?: { sub?: string };
      };
    };
  };
};

export function isOidcEndSessionSuccessContext(
  ctx: unknown,
): ctx is OidcEndSessionSuccessContext {
  return ctx !== null && typeof ctx === 'object';
}

/** Sync read of OIDC account id before async work (end_session redirect race). */
export function readEndSessionAccountId(ctx: unknown): string | undefined {
  if (!ctx || typeof ctx !== 'object') {
    return undefined;
  }

  const oidc = Reflect.get(ctx, 'oidc');
  if (!oidc || typeof oidc !== 'object') {
    return undefined;
  }

  const session = Reflect.get(oidc, 'session');
  if (session && typeof session === 'object') {
    const accountId = Reflect.get(session, 'accountId');
    if (typeof accountId === 'string' && accountId.length > 0) {
      return accountId;
    }
  }

  const entities = Reflect.get(oidc, 'entities');
  if (entities && typeof entities === 'object') {
    const idTokenHint = Reflect.get(entities, 'IdTokenHint');
    if (idTokenHint && typeof idTokenHint === 'object') {
      const payload = Reflect.get(idTokenHint, 'payload');
      if (payload && typeof payload === 'object') {
        const sub = Reflect.get(payload, 'sub');
        if (typeof sub === 'string' && sub.length > 0) {
          return sub;
        }
      }
    }
  }

  return undefined;
}

export function readOidcExpressPair(
  ctx: unknown,
): { req: unknown; res: unknown } | null {
  if (!ctx || typeof ctx !== 'object') {
    return null;
  }

  const req = Reflect.get(ctx, 'req');
  const res = Reflect.get(ctx, 'res');

  if (!req || !res) {
    return null;
  }

  return { req, res };
}

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
