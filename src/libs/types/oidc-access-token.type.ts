import { JWTPayload } from 'jose';

/**
 * Verified OIDC access token claims attached by {@link JwtResourceGuard}.
 * Copy this type into consumer APIs (e.g. byte-forge-auth).
 */
export type OidcAccessTokenContext = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  aud: string | string[];
  iss: string;
  claims: JWTPayload;
};

export type RequestWithOidcAccessToken = {
  oidcAccessToken?: OidcAccessTokenContext;
};
