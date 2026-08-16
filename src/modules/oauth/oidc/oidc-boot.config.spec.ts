import { assertValidOidcIssuer, OidcBootConfigError } from './oidc-issuer.validation';

describe('assertValidOidcIssuer', () => {
  it('accepts a valid issuer URL', () => {
    expect(() => assertValidOidcIssuer('http://localhost:3010')).not.toThrow();
  });

  it('rejects trailing slash', () => {
    expect(() => assertValidOidcIssuer('http://localhost:3010/')).toThrow(
      OidcBootConfigError,
    );
  });

  it('rejects invalid URLs', () => {
    expect(() => assertValidOidcIssuer('not-a-url')).toThrow(OidcBootConfigError);
  });
});
