import { Injectable } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';
import { OidcClientRegistry } from './oidc-client.registry';
import { createOidcAdapterFactory } from './oidc-adapter.factory';
import { OidcJwksService } from './oidc-jwks.service';
import { OIDC_PROVIDER_ROUTES } from './oidc-routes.constants';

export type OidcProviderInstance = {
  issuer: string;
  callback: () => (req: unknown, res: unknown, next?: () => void) => void;
};

type OidcProviderConstructor = new (
  issuer: string,
  configuration: Record<string, unknown>,
) => OidcProviderInstance;

@Injectable()
export class OidcProviderFactory {
  constructor(
    private readonly appEnv: AppEnvService,
    private readonly clientRegistry: OidcClientRegistry,
    private readonly jwksService: OidcJwksService,
  ) {}

  async create(): Promise<OidcProviderInstance> {
    const { Provider } = (await import('oidc-provider')) as {
      Provider: OidcProviderConstructor;
    };

    const adapter = await createOidcAdapterFactory(this.clientRegistry);
    const jwks = await this.jwksService.loadSigningJwks();

    return new Provider(this.appEnv.OIDC_ISSUER, {
      adapter,
      clients: [],
      cookies: {
        keys: [this.appEnv.JWT_USER_ACCESS_SECRET],
      },
      features: {
        devInteractions: { enabled: false },
        introspection: { enabled: true },
        revocation: { enabled: true },
      },
      pkce: {
        required: () => true,
      },
      routes: OIDC_PROVIDER_ROUTES,
      ttl: {
        AccessToken: this.appEnv.OIDC_ACCESS_TOKEN_TTL,
        IdToken: this.appEnv.OIDC_ACCESS_TOKEN_TTL,
      },
      jwks,
      findAccount: async () => undefined,
    });
  }
}
