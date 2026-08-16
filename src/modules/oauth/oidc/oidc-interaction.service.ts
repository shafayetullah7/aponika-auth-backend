import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppEnvService } from '@/libs/config/app-env.service';
import { OAuthConsentRepository } from '@/modules/oauth/oauth-consent.repository';
import { OAuthClientRepository } from '@/modules/oauth/oauth-client.repository';
import {
  buildOidcIssuerUrl,
  OIDC_INTERACTION_PATH_PREFIX,
} from './oidc-routes.constants';
import type { OidcProviderInstance } from './oidc-provider.factory';
import {
  augmentInteractionRequest,
  createCapturingInteractionResponse,
} from './oidc-interaction-request.util';
import { OidcUserSessionBridge } from './oidc-user-session.bridge';

type OidcInteractionPrompt = {
  name: string;
  details?: {
    missingOIDCScope?: string[];
    missingOIDCClaims?: string[];
    missingResourceScopes?: Record<string, string[]>;
  };
};

type OidcInteractionDetails = {
  prompt: OidcInteractionPrompt;
  params: {
    client_id: string;
    scope?: string;
    redirect_uri?: string;
    state?: string;
  };
  grantId?: string;
  session?: {
    accountId?: string;
  };
};

type OidcGrantInstance = {
  addOIDCScope(scope: string): void;
  addOIDCClaims(claims: string[]): void;
  addResourceScope(indicator: string, scope: string): void;
  getOIDCScope(): string;
  save(): Promise<string>;
};

export type OidcConsentPromptDetails = {
  interactionUid: string;
  clientId: string;
  clientName: string;
  clientDescription: string | null;
  scopes: string[];
};

@Injectable()
export class OidcInteractionService {
  private readonly logger = new Logger(OidcInteractionService.name);

  constructor(
    private readonly appEnv: AppEnvService,
    private readonly sessionBridge: OidcUserSessionBridge,
    private readonly oauthClientRepository: OAuthClientRepository,
    private readonly consentRepository: OAuthConsentRepository,
  ) {}

  buildInteractionPath(uid: string): string {
    return `${OIDC_INTERACTION_PATH_PREFIX}/${uid}`;
  }

  buildLoginRedirectUrl(interactionUid: string): string {
    const resumeUrl = buildOidcIssuerUrl(
      this.appEnv.OIDC_ISSUER,
      this.buildInteractionPath(interactionUid),
    );
    const loginUrl = new URL('/login', this.appEnv.AUTH_FRONTEND_URL);
    loginUrl.searchParams.set('returnTo', resumeUrl);
    return loginUrl.toString();
  }

  buildConsentRedirectUrl(interactionUid: string): string {
    const resumeUrl = buildOidcIssuerUrl(
      this.appEnv.OIDC_ISSUER,
      this.buildInteractionPath(interactionUid),
    );
    const consentUrl = new URL('/consent', this.appEnv.AUTH_FRONTEND_URL);
    consentUrl.searchParams.set('returnTo', resumeUrl);
    return consentUrl.toString();
  }

  async resume(
    req: Request,
    res: Response,
    provider: OidcProviderInstance,
  ): Promise<void> {
    const auth = await this.sessionBridge.resolveAuthenticatedUser(req, res);
    if (!auth) {
      const uid = this.readInteractionUid(req);
      if (!uid) {
        res.status(400).send('Missing interaction id');
        return;
      }

      res.statusCode = 302;
      res.setHeader('Location', this.buildLoginRedirectUrl(uid));
      res.end();
      return;
    }

    const details = (await provider.interactionDetails(
      req,
      res,
    )) as OidcInteractionDetails;

    if (details.prompt.name === 'login') {
      await provider.interactionFinished(
        req,
        res,
        { login: { accountId: auth.user.id } },
        { mergeWithLastSubmission: false },
      );
      return;
    }

    if (details.prompt.name === 'consent') {
      const client = await this.oauthClientRepository.findByClientId(
        details.params.client_id,
      );
      if (client?.trustedFirstParty) {
        await this.finishConsentInteraction(req, res, provider, details, {
          remember: false,
        });
        return;
      }

      const uid = this.readInteractionUid(req);
      if (!uid) {
        res.status(400).send('Missing interaction id');
        return;
      }

      res.statusCode = 302;
      res.setHeader('Location', this.buildConsentRedirectUrl(uid));
      res.end();
      return;
    }

    this.logger.warn(
      `Unsupported OIDC interaction prompt: ${details.prompt.name}`,
    );
    await provider.interactionFinished(
      req,
      res,
      {
        error: 'server_error',
        error_description: 'Unsupported interaction prompt',
      },
      { mergeWithLastSubmission: false },
    );
  }

  async getConsentPromptDetails(
    req: Request,
    uid: string,
    userId: string,
    provider: OidcProviderInstance,
  ): Promise<OidcConsentPromptDetails> {
    const details = await this.readInteractionDetails(req, provider, uid);
    this.assertConsentPromptForUser(details, userId);

    const client = await this.oauthClientRepository.findByClientId(
      details.params.client_id,
    );
    if (!client) {
      throw new NotFoundException('OAuth client not found');
    }

    const scopes = this.resolveRequestedScopes(details);

    return {
      interactionUid: uid,
      clientId: client.clientId,
      clientName: client.name,
      clientDescription: client.description,
      scopes,
    };
  }

  async allowConsent(
    req: Request,
    uid: string,
    userId: string,
    remember: boolean,
    provider: OidcProviderInstance,
  ): Promise<{ redirectUrl: string }> {
    const details = await this.readInteractionDetails(req, provider, uid);
    this.assertConsentPromptForUser(details, userId);

    augmentInteractionRequest(req, uid);
    const capture = createCapturingInteractionResponse();
    await this.finishConsentInteraction(
      req,
      capture.res,
      provider,
      details,
      { remember },
    );

    const redirectUrl = capture.getRedirectUrl();
    if (!redirectUrl) {
      throw new BadRequestException('Consent could not be completed');
    }

    return { redirectUrl };
  }

  async denyConsent(
    req: Request,
    uid: string,
    userId: string,
    provider: OidcProviderInstance,
  ): Promise<{ redirectUrl: string }> {
    const details = await this.readInteractionDetails(req, provider, uid);
    this.assertConsentPromptForUser(details, userId);

    augmentInteractionRequest(req, uid);
    const capture = createCapturingInteractionResponse();

    await provider.interactionFinished(
      req,
      capture.res,
      {
        error: 'access_denied',
        error_description: 'User denied consent',
      },
      { mergeWithLastSubmission: true },
    );

    const redirectUrl = capture.getRedirectUrl();
    if (!redirectUrl) {
      throw new BadRequestException('Consent denial could not be completed');
    }

    return { redirectUrl };
  }

  private async finishConsentInteraction(
    req: Request,
    res: Response,
    provider: OidcProviderInstance,
    details: OidcInteractionDetails,
    options: { remember: boolean },
  ): Promise<void> {
    const accountId = details.session?.accountId;
    if (!accountId) {
      await provider.interactionFinished(
        req,
        res,
        {
          error: 'access_denied',
          error_description: 'Login required',
        },
        { mergeWithLastSubmission: false },
      );
      return;
    }

    let grant: OidcGrantInstance | undefined;
    if (details.grantId) {
      grant = (await provider.Grant.find(details.grantId)) as
        | OidcGrantInstance
        | undefined;
    }

    if (!grant) {
      grant = new provider.Grant({
        accountId,
        clientId: details.params.client_id,
      }) as OidcGrantInstance;
    }

    const { missingOIDCScope, missingOIDCClaims, missingResourceScopes } =
      details.prompt.details ?? {};

    if (missingOIDCScope?.length) {
      grant.addOIDCScope(missingOIDCScope.join(' '));
    }

    if (missingOIDCClaims?.length) {
      grant.addOIDCClaims(missingOIDCClaims);
    }

    if (missingResourceScopes) {
      for (const [indicator, scope] of Object.entries(missingResourceScopes)) {
        grant.addResourceScope(indicator, scope.join(' '));
      }
    }

    const grantId = await grant.save();

    if (options.remember) {
      const client = await this.oauthClientRepository.findByClientId(
        details.params.client_id,
      );
      if (client) {
        const scopes = grant
          .getOIDCScope()
          .split(' ')
          .filter((scope) => scope.length > 0);

        await this.consentRepository.upsert({
          userId: accountId,
          oauthClientId: client.id,
          scopes,
          remember: true,
        });
      }
    }

    await provider.interactionFinished(
      req,
      res,
      { consent: { grantId } },
      { mergeWithLastSubmission: true },
    );
  }

  private async readInteractionDetails(
    req: Request,
    provider: OidcProviderInstance,
    uid?: string,
    res?: Response,
  ): Promise<OidcInteractionDetails> {
    if (uid) {
      augmentInteractionRequest(req, uid);
    }

    const interactionRes = res ?? createCapturingInteractionResponse().res;

    return (await provider.interactionDetails(
      req,
      interactionRes,
    )) as OidcInteractionDetails;
  }

  private assertConsentPromptForUser(
    details: OidcInteractionDetails,
    userId: string,
  ): void {
    if (details.prompt.name !== 'consent') {
      throw new BadRequestException('Interaction is not awaiting consent');
    }

    if (details.session?.accountId !== userId) {
      throw new ForbiddenException('Interaction does not belong to this user');
    }
  }

  private resolveRequestedScopes(details: OidcInteractionDetails): string[] {
    const missing = details.prompt.details?.missingOIDCScope ?? [];
    const requested = details.params.scope?.split(' ').filter(Boolean) ?? [];
    const scopes = new Set([...requested, ...missing]);
    scopes.delete('offline_access');
    return [...scopes];
  }

  private readInteractionUid(req: Request): string | undefined {
    const uid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
    return uid || undefined;
  }
}
