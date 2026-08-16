import { Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppEnvService } from '@/libs/config/app-env.service';
import {
  buildOidcIssuerUrl,
  OIDC_INTERACTION_PATH_PREFIX,
} from './oidc-routes.constants';
import type { OidcProviderInstance } from './oidc-provider.factory';
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
  save(): Promise<string>;
};

@Injectable()
export class OidcInteractionService {
  private readonly logger = new Logger(OidcInteractionService.name);

  constructor(
    private readonly appEnv: AppEnvService,
    private readonly sessionBridge: OidcUserSessionBridge,
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

  async resume(
    req: Request,
    res: Response,
    provider: OidcProviderInstance,
  ): Promise<void> {
    const auth = await this.sessionBridge.resolveAuthenticatedUser(req, res);
    if (!auth) {
      const uid = Array.isArray(req.params.uid)
        ? req.params.uid[0]
        : req.params.uid;
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
      await this.finishConsentInteraction(req, res, provider, details);
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

  private async finishConsentInteraction(
    req: Request,
    res: Response,
    provider: OidcProviderInstance,
    details: OidcInteractionDetails,
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

    await provider.interactionFinished(
      req,
      res,
      { consent: { grantId } },
      { mergeWithLastSubmission: true },
    );
  }
}
