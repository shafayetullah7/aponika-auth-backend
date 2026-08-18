import { Injectable } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';
import { OAuthConsentRepository } from '@/modules/oauth/repositories/oauth-consent.repository';
import { OAuthClientRepository } from '@/modules/oauth/repositories/oauth-client.repository';

export const RESOURCE_SCOPE_PREFIX = 'rs:';

type OidcLoadGrantContext = {
  oidc: {
    account?: { accountId: string };
    client: { clientId: string };
    params?: { resource?: string | string[] };
    requestParamOIDCScopes: Set<string>;
    result?: { consent?: { grantId?: string } };
    session?: { grantIdFor: (clientId: string) => string | undefined };
    provider: {
      Grant: {
        find: (id: string) => Promise<unknown>;
        new (payload: {
          accountId: string;
          clientId: string;
        }): OidcGrantInstance;
      };
    };
  };
};

type OidcGrantInstance = {
  addOIDCScope(scope: string): void;
  addResourceScope(indicator: string, scope: string): void;
  getOIDCScope(): string;
  save(): Promise<string>;
};

@Injectable()
export class OidcConsentGrantService {
  constructor(
    private readonly consentRepository: OAuthConsentRepository,
    private readonly oauthClientRepository: OAuthClientRepository,
    private readonly appEnv: AppEnvService,
  ) {}

  loadExistingGrant = async (ctx: unknown): Promise<unknown> => {
    const { oidc } = ctx as OidcLoadGrantContext;
    const accountId = oidc.account?.accountId;

    if (accountId) {
      const client = await this.oauthClientRepository.findByClientId(
        oidc.client.clientId,
      );

      if (client) {
        const consent = await this.consentRepository.findRemembered(
          accountId,
          client.id,
        );

        if (consent && this.rememberedGrantCoversRequest(consent.scopes, oidc)) {
          const grant = new oidc.provider.Grant({
            accountId,
            clientId: oidc.client.clientId,
          }) as OidcGrantInstance;

          const oidcScopes = this.oidcScopesFromStored(consent.scopes);
          grant.addOIDCScope(oidcScopes.join(' '));
          for (const indicator of this.resourceIndicatorsFromStored(
            consent.scopes,
          )) {
            grant.addResourceScope(indicator, oidcScopes.join(' '));
          }
          await grant.save();

          return grant;
        }
      }
    }

    const grantId =
      oidc.result?.consent?.grantId
      ?? oidc.session?.grantIdFor(oidc.client.clientId);

    if (grantId) {
      return oidc.provider.Grant.find(grantId);
    }

    return undefined;
  };

  rememberedGrantCoversRequest(
    storedScopes: string[],
    oidc: OidcLoadGrantContext['oidc'],
  ): boolean {
    if (!this.scopesAreGranted(this.oidcScopesFromStored(storedScopes), oidc.requestParamOIDCScopes)) {
      return false;
    }

    const storedResources = this.resourceIndicatorsFromStored(storedScopes);
    const requested = this.requestedResourceIndicators(oidc.params?.resource);
    return requested.every((indicator) => storedResources.includes(indicator));
  }

  scopesAreGranted(
    storedScopes: string[],
    requestedScopes: Iterable<string>,
  ): boolean {
    const granted = new Set(storedScopes);
    for (const scope of requestedScopes) {
      if (!granted.has(scope)) {
        return false;
      }
    }

    return true;
  }

  oidcScopesFromStored(storedScopes: string[]): string[] {
    return storedScopes.filter((scope) => !scope.startsWith(RESOURCE_SCOPE_PREFIX));
  }

  resourceIndicatorsFromStored(storedScopes: string[]): string[] {
    return storedScopes
      .filter((scope) => scope.startsWith(RESOURCE_SCOPE_PREFIX))
      .map((scope) => scope.slice(RESOURCE_SCOPE_PREFIX.length));
  }

  encodeResourceIndicator(indicator: string): string {
    return `${RESOURCE_SCOPE_PREFIX}${indicator}`;
  }

  requestedResourceIndicators(
    resource: string | string[] | undefined,
  ): string[] {
    if (Array.isArray(resource) && resource.length > 0) {
      return resource;
    }
    if (typeof resource === 'string' && resource.length > 0) {
      return [resource];
    }
    return [this.appEnv.OIDC_DEFAULT_RESOURCE];
  }
}
