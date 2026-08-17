import { OAuthClientUriKindEnum } from '@/_db/drizzle/enum';
import { OAuthClientValidationError } from '../../oauth-client.errors';
import {
  extractOrigin,
  validateOAuthUri,
  validateUriBundle,
} from '../../oauth-client-uri.validation';

describe('oauth-client-uri.validation', () => {
  it('accepts local http redirect URIs', () => {
    expect(
      validateOAuthUri(
        'http://localhost:3000/auth/callback',
        OAuthClientUriKindEnum.REDIRECT,
      ),
    ).toBe('http://localhost:3000/auth/callback');
  });

  it('rejects non-https remote redirect URIs', () => {
    expect(() =>
      validateOAuthUri(
        'http://example.com/auth/callback',
        OAuthClientUriKindEnum.REDIRECT,
      ),
    ).toThrow(OAuthClientValidationError);
  });

  it('rejects wildcard redirect URIs', () => {
    expect(() =>
      validateOAuthUri(
        'https://example.com/*',
        OAuthClientUriKindEnum.REDIRECT,
      ),
    ).toThrow('Wildcard URIs are not allowed');
  });

  it('requires allowed origins to cover redirect origins', () => {
    expect(() =>
      validateUriBundle({
        redirectUris: ['http://localhost:3000/auth/callback'],
        allowedOrigins: ['http://localhost:3011'],
      }),
    ).toThrow('Allowed origins must include redirect URI origin');
  });

  it('derives allowed origins from redirect URIs when omitted', () => {
    const bundle = validateUriBundle({
      redirectUris: ['http://localhost:3000/auth/callback'],
    });

    expect(bundle.allowedOrigins).toEqual(['http://localhost:3000']);
    expect(extractOrigin(bundle.redirectUris[0])).toBe('http://localhost:3000');
  });
});
