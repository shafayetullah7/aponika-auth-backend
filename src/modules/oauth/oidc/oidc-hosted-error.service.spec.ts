import { OidcHostedErrorService } from './oidc-hosted-error.service';

describe('OidcHostedErrorService', () => {
  const appEnv = {
    AUTH_FRONTEND_URL: 'http://localhost:3011',
  } as never;

  it('builds hosted error URL with OAuth params', () => {
    const service = new OidcHostedErrorService(appEnv);
    const url = new URL(
      service.buildHostedErrorUrl({
        error: 'invalid_request',
        error_description: 'redirect_uri mismatch',
        state: 'abc',
      }),
    );

    expect(url.origin).toBe('http://localhost:3011');
    expect(url.pathname).toBe('/oauth/error');
    expect(url.searchParams.get('error')).toBe('invalid_request');
    expect(url.searchParams.get('error_description')).toBe('redirect_uri mismatch');
    expect(url.searchParams.get('state')).toBe('abc');
  });
});
