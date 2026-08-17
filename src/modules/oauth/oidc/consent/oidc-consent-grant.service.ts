import { Injectable } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';
import { OAuthConsentRepository } from '@/modules/oauth/repositories/oauth-consent.repository';
import { OAuthClientRepository } from '@/modules/oauth/repositories/oauth-client.repository';

type OidcLoadGrantContext = {
  oidc: {
    account?: { accountId: string };
    client: { clientId: string };
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

        if (
          consent &&
          this.scopesAreGranted(consent.scopes, oidc.requestParamOIDCScopes)
        ) {
          const grant = new oidc.provider.Grant({
            accountId,
            clientId: oidc.client.clientId,
          }) as OidcGrantInstance;

          grant.addOIDCScope([...oidc.requestParamOIDCScopes].join(' '));
          grant.addResourceScope(
            this.appEnv.OIDC_DEFAULT_RESOURCE,
            [...oidc.requestParamOIDCScopes].join(' '),
          );
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
}
