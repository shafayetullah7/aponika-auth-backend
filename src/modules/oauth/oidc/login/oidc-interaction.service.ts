import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppEnvService } from '@/libs/config/app-env.service';
import { OAuthConsentRepository } from '@/modules/oauth/repositories/oauth-consent.repository';
import { OAuthClientRepository } from '@/modules/oauth/repositories/oauth-client.repository';
import {
  buildOidcIssuerUrl,
  OIDC_INTERACTION_PATH_PREFIX,
} from '../provider/oidc-routes.constants';
import type { OidcProviderInstance, OidcStoredInteraction } from '../provider/oidc-provider.factory';
import { createCapturingInteractionResponse } from './oidc-interaction-request.util';
import { OidcHostedErrorService } from './oidc-hosted-error.service';
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
  autoRedirectUrl?: string;
};

@Injectable()
export class OidcInteractionService {
  private readonly logger = new Logger(OidcInteractionService.name);

  constructor(
    private readonly appEnv: AppEnvService,
    private readonly sessionBridge: OidcUserSessionBridge,
    private readonly oauthClientRepository: OAuthClientRepository,
    private readonly consentRepository: OAuthConsentRepository,
    private readonly hostedErrorService: OidcHostedErrorService,
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
    const uid = this.readInteractionUid(req);
    const auth = await this.sessionBridge.resolveAuthenticatedUser(req, res);
    if (!auth) {
      if (!uid) {
        this.redirectToHostedError(res, {
          error: 'invalid_request',
          error_description: 'Missing OIDC interaction id.',
        });
        return;
      }

      res.statusCode = 302;
      res.setHeader('Location', this.buildLoginRedirectUrl(uid));
      res.end();
      return;
    }

    try {
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
          // Cookie is present on GET /interaction/:uid — finish in-process (303).
          await this.finishConsentInteraction(req, res, provider, details, {
            remember: false,
          });
          return;
        }

        if (!uid) {
          this.redirectToHostedError(res, {
            error: 'invalid_request',
            error_description: 'Missing OIDC interaction id.',
          });
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
    } catch (error) {
      this.redirectInteractionResumeError(
        res,
        error,
        uid,
        this.readStateFromInteractionError(error),
      );
    }
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
      throw new NotFoundException(
        `OAuth client "${details.params.client_id}" is not registered on this identity server`,
      );
    }

    const scopes = this.resolveRequestedScopes(details);

    if (client.trustedFirstParty) {
      const redirectUrl = await this.finishConsentInteraction(
        req,
        createCapturingInteractionResponse().res,
        provider,
        details,
        { remember: false, interactionUid: uid },
      );

      if (!redirectUrl) {
        throw new BadRequestException('Consent could not be completed');
      }

      return {
        interactionUid: uid,
        clientId: client.clientId,
        clientName: client.name,
        clientDescription: client.description,
        scopes,
        autoRedirectUrl: redirectUrl,
      };
    }

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

    const redirectUrl = await this.finishConsentInteraction(
      req,
      createCapturingInteractionResponse().res,
      provider,
      details,
      { remember, interactionUid: uid },
    );

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

    const redirectUrl = await this.completeInteractionResult(
      provider,
      uid,
      {
        error: 'access_denied',
        error_description: 'User denied consent',
      },
      true,
    );

    return { redirectUrl };
  }

  private async finishConsentInteraction(
    req: Request,
    res: Response,
    provider: OidcProviderInstance,
    details: OidcInteractionDetails,
    options: { remember: boolean; interactionUid?: string },
  ): Promise<string | void> {
    const accountId = details.session?.accountId;
    if (!accountId) {
      if (options.interactionUid) {
        return this.completeInteractionResult(
          provider,
          options.interactionUid,
          {
            error: 'access_denied',
            error_description: 'Login required',
          },
          false,
        );
      }

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

    const consentResult = { consent: { grantId } };

    if (options.interactionUid) {
      return this.completeInteractionResult(
        provider,
        options.interactionUid,
        consentResult,
        true,
      );
    }

    await provider.interactionFinished(req, res, consentResult, {
      mergeWithLastSubmission: true,
    });
  }

  private async readInteractionDetails(
    req: Request,
    provider: OidcProviderInstance,
    uid?: string,
    res?: Response,
  ): Promise<OidcInteractionDetails> {
    if (uid) {
      try {
        const interaction = await this.findInteractionByUid(provider, uid);
        return this.mapStoredInteraction(interaction);
      } catch (error) {
        throw this.toConsentInteractionError(error, uid);
      }
    }

    const interactionRes = res ?? createCapturingInteractionResponse().res;

    try {
      return (await provider.interactionDetails(
        req,
        interactionRes,
      )) as OidcInteractionDetails;
    } catch (error) {
      throw this.toConsentInteractionError(error, uid);
    }
  }

  private async findInteractionByUid(
    provider: OidcProviderInstance,
    uid: string,
  ): Promise<OidcStoredInteraction> {
    const interaction = await provider.Interaction.find(uid);
    if (!interaction) {
      throw new BadRequestException(
        'OIDC interaction session is missing or expired. Start sign-in again from the application.',
      );
    }

    return interaction;
  }

  private mapStoredInteraction(
    interaction: OidcStoredInteraction,
  ): OidcInteractionDetails {
    return {
      prompt: interaction.prompt,
      params: interaction.params,
      grantId: interaction.grantId,
      session: interaction.session,
    };
  }

  private async completeInteractionResult(
    provider: OidcProviderInstance,
    uid: string,
    result: Record<string, unknown>,
    mergeWithLastSubmission: boolean,
  ): Promise<string> {
    const interaction = await this.findInteractionByUid(provider, uid);

    if (mergeWithLastSubmission && !('error' in result)) {
      interaction.result = {
        ...interaction.lastSubmission,
        ...result,
      };
    } else {
      interaction.result = result;
    }

    const ttlSeconds = Math.max(0, interaction.exp - Math.floor(Date.now() / 1000));
    await interaction.save(ttlSeconds);

    return interaction.returnTo;
  }

  private redirectToHostedError(
    res: Response,
    payload: {
      error?: string;
      error_description?: string;
      state?: string;
    },
  ): void {
    res.statusCode = 303;
    res.setHeader(
      'Location',
      this.hostedErrorService.buildHostedErrorUrl(payload),
    );
    res.end();
  }

  private redirectInteractionResumeError(
    res: Response,
    error: unknown,
    uid?: string,
    state?: string,
  ): void {
    const message = error instanceof Error ? error.message : String(error);
    const errorDescription =
      error instanceof Error && 'error_description' in error
        ? String(
            (error as Error & { error_description?: string }).error_description,
          )
        : undefined;

    this.logger.warn(
      `Failed to resume OIDC interaction${uid ? ` for ${uid}` : ''}: ${errorDescription ?? message}`,
    );

    if (this.isInteractionSessionError(error)) {
      this.redirectToHostedError(res, {
        error: 'interaction_expired',
        error_description:
          'OIDC interaction session is missing or expired. Start sign-in again from the application.',
        state,
      });
      return;
    }

    this.redirectToHostedError(res, {
      error: 'server_error',
      error_description:
        'OIDC interaction could not be completed. Start sign-in again from the application.',
      state,
    });
  }

  private isInteractionSessionError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const errorName =
      error instanceof Error && 'name' in error
        ? String(error.name)
        : undefined;

    return (
      errorName === 'SessionNotFound'
      || message.includes('interaction session id cookie not found')
      || message.includes('interaction session not found')
      || message.includes('session not found')
    );
  }

  private readStateFromInteractionError(error: unknown): string | undefined {
    if (
      error instanceof Error
      && 'state' in error
      && typeof (error as Error & { state?: unknown }).state === 'string'
    ) {
      return (error as Error & { state: string }).state;
    }

    return undefined;
  }

  private toConsentInteractionError(error: unknown, uid?: string): never {
    const message = error instanceof Error ? error.message : String(error);
    const errorDescription =
      error instanceof Error && 'error_description' in error
        ? String(
            (error as Error & { error_description?: string }).error_description,
          )
        : undefined;

    this.logger.warn(
      `Failed to read OIDC interaction details${uid ? ` for ${uid}` : ''}: ${errorDescription ?? message}`,
    );

    if (this.isInteractionSessionError(error)) {
      throw new BadRequestException(
        'OIDC interaction session is missing or expired. Start sign-in again from the application.',
      );
    }

    throw new BadRequestException(
      'OIDC interaction could not be loaded. Start sign-in again from the application.',
    );
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
    const rawUid = req.params?.uid;
    if (!rawUid) {
      return undefined;
    }

    const uid = Array.isArray(rawUid) ? rawUid[0] : rawUid;
    return uid || undefined;
  }
}
