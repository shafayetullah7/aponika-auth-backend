import { OAuthClientUriKindEnum } from '@/_db/drizzle/enum';
import { OAuthClientValidationError } from './oauth-client.errors';

export type TOAuthUriKind =
  (typeof OAuthClientUriKindEnum)[keyof typeof OAuthClientUriKindEnum];

export function extractOrigin(uri: string): string {
  const url = parseOAuthUrl(uri, OAuthClientUriKindEnum.REDIRECT);
  return url.origin;
}

export function normalizeAllowedOrigin(uri: string): string {
  const url = parseOAuthUrl(uri, OAuthClientUriKindEnum.ALLOWED_ORIGIN);

  if (url.pathname !== '/' && url.pathname !== '') {
    throw new OAuthClientValidationError(
      'Allowed origins must not include a path',
    );
  }

  if (url.search || url.hash) {
    throw new OAuthClientValidationError(
      'Allowed origins must not include query or fragment',
    );
  }

  return url.origin;
}

export function validateOAuthUri(uri: string, kind: TOAuthUriKind): string {
  if (uri.includes('*')) {
    throw new OAuthClientValidationError('Wildcard URIs are not allowed');
  }

  const url = parseOAuthUrl(uri, kind);
  assertSecureOrLocalHttp(url);
  return kind === OAuthClientUriKindEnum.ALLOWED_ORIGIN
    ? normalizeAllowedOrigin(uri)
    : uri;
}

export function validateUriBundle(input: {
  redirectUris: string[];
  postLogoutRedirectUris?: string[];
  allowedOrigins?: string[];
}): {
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  allowedOrigins: string[];
} {
  const redirectUris = input.redirectUris.map((uri) =>
    validateOAuthUri(uri, OAuthClientUriKindEnum.REDIRECT),
  );
  const postLogoutRedirectUris = (input.postLogoutRedirectUris ?? []).map(
    (uri) => validateOAuthUri(uri, OAuthClientUriKindEnum.POST_LOGOUT),
  );

  const redirectOrigins = new Set(redirectUris.map(extractOrigin));
  const allowedOrigins = (input.allowedOrigins ?? []).map((uri) =>
    normalizeAllowedOrigin(uri),
  );

  if (allowedOrigins.length > 0) {
    for (const origin of redirectOrigins) {
      if (!allowedOrigins.includes(origin)) {
        throw new OAuthClientValidationError(
          `Allowed origins must include redirect URI origin: ${origin}`,
        );
      }
    }
  }

  const resolvedAllowedOrigins =
    allowedOrigins.length > 0 ? allowedOrigins : [...redirectOrigins];

  return {
    redirectUris,
    postLogoutRedirectUris,
    allowedOrigins: resolvedAllowedOrigins,
  };
}

function parseOAuthUrl(uri: string, kind: TOAuthUriKind): URL {
  try {
    return new URL(uri);
  } catch {
    throw new OAuthClientValidationError(`Invalid ${kind} URI: ${uri}`);
  }
}

function assertSecureOrLocalHttp(url: URL): void {
  const isLocalHttp =
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1');

  if (!isLocalHttp && url.protocol !== 'https:') {
    throw new OAuthClientValidationError(
      'URIs must use HTTPS except for http://localhost and http://127.0.0.1',
    );
  }
}
