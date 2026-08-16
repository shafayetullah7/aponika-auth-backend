import { readFile } from 'node:fs/promises';
import { AppEnvService } from '@/libs/config/app-env.service';
import { Injectable } from '@nestjs/common';
import { OidcClientRegistry } from './oidc-client.registry';
import { createOidcAdapterFactory } from './oidc-adapter.factory';

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
  ) {}

  async create(): Promise<OidcProviderInstance> {
    const { Provider } = (await import('oidc-provider')) as {
      Provider: OidcProviderConstructor;
    };

    const adapter = await createOidcAdapterFactory(this.clientRegistry);
    const jwks = await this.resolveJwks();

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
      ttl: {
        AccessToken: this.appEnv.OIDC_ACCESS_TOKEN_TTL,
        IdToken: this.appEnv.OIDC_ACCESS_TOKEN_TTL,
      },
      jwks,
      findAccount: async () => undefined,
    });
  }

  private async resolveJwks(): Promise<{ keys: unknown[] } | undefined> {
    const keyPath = this.appEnv.OIDC_JWKS_PRIVATE_KEY_PATH?.trim();
    if (!keyPath) {
      return undefined;
    }

    const pem = await readFile(keyPath, 'utf8');
    const { importPKCS8, exportJWK } = await import('jose');
    const privateKey = await importPKCS8(pem, 'RS256');
    const jwk = await exportJWK(privateKey);

    return {
      keys: [
        {
          ...jwk,
          use: 'sig',
          alg: 'RS256',
          kid: 'aponika-oidc-1',
        },
      ],
    };
  }
}
