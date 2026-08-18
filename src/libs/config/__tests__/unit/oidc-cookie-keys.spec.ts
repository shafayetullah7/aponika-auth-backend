import {
  OIDC_COOKIE_KEYS_DEV_DEFAULT,
  parseOidcCookieKeys,
} from '../../env.schema';

describe('parseOidcCookieKeys', () => {
  it('splits comma-separated keys and ignores blanks', () => {
    expect(parseOidcCookieKeys(' alpha, beta , ,gamma ')).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
  });

  it('returns an empty list for missing values', () => {
    expect(parseOidcCookieKeys(undefined)).toEqual([]);
    expect(parseOidcCookieKeys('')).toEqual([]);
  });

  it('dev default is distinct from typical JWT secret examples', () => {
    expect(OIDC_COOKIE_KEYS_DEV_DEFAULT).not.toContain('user-access-secret');
    expect(OIDC_COOKIE_KEYS_DEV_DEFAULT.length).toBeGreaterThanOrEqual(32);
  });
});
