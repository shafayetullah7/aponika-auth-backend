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
    params?: { state?: string };
    session?: { accountId?: string };
    entities?: {
      IdTokenHint?: {
        payload?: { sub?: string };
      };
    };
  };
};

export const OIDC_LOGOUT_STATE_ALL_PREFIX = 'all.';
export const OIDC_LOGOUT_STATE_BROWSER_PREFIX = 'browser.';

export function isAllDevicesLogoutState(state: string | undefined): boolean {
  return typeof state === 'string' && state.startsWith(OIDC_LOGOUT_STATE_ALL_PREFIX);
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readStateField(container: unknown): string | undefined {
  if (!container || typeof container !== 'object') {
    return undefined;
  }
  return readNonEmptyString(Reflect.get(container, 'state'));
}

/**
 * RP `state` on end_session. Confirm POST only sends xsrf/logout; oidc-provider
 * keeps the original RP state on `session.state.state` until after destroy.
 */
export function readEndSessionLogoutState(ctx: unknown): string | undefined {
  if (!ctx || typeof ctx !== 'object') {
    return undefined;
  }

  const oidc = Reflect.get(ctx, 'oidc');
  if (oidc && typeof oidc === 'object') {
    const fromParams = readStateField(Reflect.get(oidc, 'params'));
    if (fromParams) {
      return fromParams;
    }

    const session = Reflect.get(oidc, 'session');
    if (session && typeof session === 'object') {
      const logoutDetails = Reflect.get(session, 'state');
      const fromLogoutSession = readStateField(logoutDetails);
      if (fromLogoutSession) {
        return fromLogoutSession;
      }
    }
  }

  const fromKoaQuery = readStateField(Reflect.get(ctx, 'query'));
  if (fromKoaQuery) {
    return fromKoaQuery;
  }

  const req = Reflect.get(ctx, 'req');
  if (!req || typeof req !== 'object') {
    return undefined;
  }

  return (
    readStateField(Reflect.get(req, 'query')) ??
    readStateField(Reflect.get(req, 'body'))
  );
}

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
