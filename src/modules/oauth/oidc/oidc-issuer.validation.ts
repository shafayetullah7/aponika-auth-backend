export class OidcBootConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OidcBootConfigError';
  }
}

export function assertValidOidcIssuer(issuer: string): void {
  if (issuer.endsWith('/')) {
    throw new OidcBootConfigError(
      'OIDC_ISSUER must not end with a trailing slash',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(issuer);
  } catch {
    throw new OidcBootConfigError('OIDC_ISSUER must be a valid URL');
  }

  if (!parsed.protocol.startsWith('http')) {
    throw new OidcBootConfigError('OIDC_ISSUER must use http or https');
  }
}
