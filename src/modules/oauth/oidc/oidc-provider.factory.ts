import { Injectable } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';
import { OidcAccountService } from './oidc-account.service';
import { OidcClientRegistry } from './oidc-client.registry';
import { createOidcAdapterFactory } from './oidc-adapter.factory';
import { OidcInteractionService } from './oidc-interaction.service';
import { OidcJwksService } from './oidc-jwks.service';
import { OidcResourceConfigService } from './oidc-resource.config';
import { OidcTokenClaimsService } from './oidc-token-claims.service';
import { OIDC_PROVIDER_ROUTES } from './oidc-routes.constants';
import type { OidcProviderEventMap } from './oidc-provider.types';

export const OIDC_AUTHORIZATION_CODE_TTL_SECONDS = 120;

export type OidcProviderInstance = {
  issuer: string;
  callback: () => (req: unknown, res: unknown, next?: () => void) => void;
  interactionDetails: (req: unknown, res: unknown) => Promise<unknown>;
  interactionFinished: (
    req: unknown,
    res: unknown,
    result: unknown,
    options?: { mergeWithLastSubmission?: boolean },
  ) => Promise<void>;
  Grant: {
    find: (id: string) => Promise<unknown>;
    new (payload: { accountId: string; clientId: string }): unknown;
  };
  on<E extends keyof OidcProviderEventMap>(
    event: E,
    handler: (ctx: OidcProviderEventMap[E]) => void,
  ): void;
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
    private readonly accountService: OidcAccountService,
    private readonly interactionService: OidcInteractionService,
    private readonly resourceConfig: OidcResourceConfigService,
    private readonly tokenClaims: OidcTokenClaimsService,
  ) {}

  async create(): Promise<OidcProviderInstance> {
    const { Provider } = (await import('oidc-provider')) as {
      Provider: OidcProviderConstructor;
    };

    const adapter = await createOidcAdapterFactory(this.clientRegistry);
    const jwks = await this.jwksService.loadSigningJwks();
    const refreshTokenTtlSeconds = Math.max(
      60,
      Math.floor(this.appEnv.SESSION_MAX_AGE / 1000),
    );

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
        resourceIndicators: {
          enabled: true,
          defaultResource: this.resourceConfig.defaultResource,
          getResourceServerInfo: this.resourceConfig.getResourceServerInfo,
          useGrantedResource: this.resourceConfig.useGrantedResource,
        },
      },
      interactions: {
        url: (_ctx, interaction) =>
          this.interactionService.buildInteractionPath(interaction.uid),
      },
      pkce: {
        required: () => true,
      },
      routes: OIDC_PROVIDER_ROUTES,
      scopes: ['openid', 'profile', 'email'],
      claims: {
        openid: ['sub'],
        email: ['email', 'email_verified'],
        profile: ['name'],
      },
      ttl: {
        AccessToken: this.appEnv.OIDC_ACCESS_TOKEN_TTL,
        IdToken: this.appEnv.OIDC_ACCESS_TOKEN_TTL,
        AuthorizationCode: OIDC_AUTHORIZATION_CODE_TTL_SECONDS,
        RefreshToken: refreshTokenTtlSeconds,
      },
      jwks,
      findAccount: (ctx, id) => this.accountService.findAccount(ctx, id),
      extraTokenClaims: this.tokenClaims.extraTokenClaims,
      issueRefreshToken: async () => true,
      conformIdTokenClaims: true,
    }) as OidcProviderInstance;
  }
}
