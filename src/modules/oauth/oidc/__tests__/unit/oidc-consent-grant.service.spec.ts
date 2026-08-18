import { AppEnvService } from '@/libs/config/app-env.service';
import {
  OidcConsentGrantService,
  RESOURCE_SCOPE_PREFIX,
} from '../../consent/oidc-consent-grant.service';

describe('OidcConsentGrantService', () => {
  const service = new OidcConsentGrantService(
    {} as never,
    {} as never,
    { OIDC_DEFAULT_RESOURCE: 'http://localhost:3005' } as AppEnvService,
  );

  it('requires stored resource indicators for a remembered grant', () => {
    const stored = [
      'openid',
      'profile',
      'email',
      `${RESOURCE_SCOPE_PREFIX}http://localhost:3005`,
    ];
    const oidc = {
      requestParamOIDCScopes: new Set(['openid', 'email']),
      params: { resource: 'http://localhost:3005' },
    };

    expect(service.rememberedGrantCoversRequest(stored, oidc as never)).toBe(
      true,
    );
    expect(
      service.rememberedGrantCoversRequest(stored, {
        ...oidc,
        params: { resource: 'http://localhost:3999' },
      } as never),
    ).toBe(false);
  });
});
