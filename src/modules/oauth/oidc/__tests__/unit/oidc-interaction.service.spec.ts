import { AppEnvService } from '@/libs/config/app-env.service';
import { OAuthConsentRepository } from '@/modules/oauth/repositories/oauth-consent.repository';
import { OAuthClientRepository } from '@/modules/oauth/repositories/oauth-client.repository';
import { OidcHostedErrorService } from '../../login/oidc-hosted-error.service';
import { OidcInteractionService, buildRpAbortRedirectUrl } from '../../login/oidc-interaction.service';
import { OidcUserSessionBridge } from '../../login/oidc-user-session.bridge';
import { createInteractionRequest, createCapturingInteractionResponse } from '../../login/oidc-interaction-request.util';

function createService(): OidcInteractionService {
  const appEnv = {
    OIDC_ISSUER: 'http://localhost:3010',
    AUTH_FRONTEND_URL: 'http://localhost:3011',
  } as AppEnvService;

  return new OidcInteractionService(
    appEnv,
    {} as OidcUserSessionBridge,
    {} as OAuthClientRepository,
    {} as OAuthConsentRepository,
    new OidcHostedErrorService(appEnv),
  );
}

describe('OidcInteractionService denyConsent', () => {
  it('finishes the interaction with access_denied using the interaction uid', async () => {
    const interaction: {
      prompt: { name: string };
      params: {
        client_id: string;
        redirect_uri: string;
        state: string;
      };
      session: { accountId: string };
      returnTo: string;
      exp: number;
      result?: Record<string, unknown>;
      save: jest.Mock;
    } = {
      prompt: { name: 'consent' },
      params: {
        client_id: 'third-party-app',
        redirect_uri: 'http://localhost:4000/auth/callback',
        state: 'third-party-state',
      },
      session: { accountId: 'user-1' },
      returnTo:
        'http://localhost:4000/auth/callback?error=access_denied&state=third-party-state',
      exp: Math.floor(Date.now() / 1000) + 600,
      save: jest.fn().mockResolvedValue(undefined),
    };

    const provider = {
      Interaction: {
        find: jest.fn().mockResolvedValue(interaction),
      },
      interactionFinished: jest.fn(),
    };

    const service = createService();

    const req = createInteractionRequest('interaction-uid', 'session=test');
    const result = await service.denyConsent(
      req,
      'interaction-uid',
      'user-1',
      provider as never,
    );

    expect(provider.Interaction.find).toHaveBeenCalledWith('interaction-uid');
    expect(interaction.save).toHaveBeenCalled();
    expect(interaction.result).toEqual({
      error: 'access_denied',
      error_description: 'User denied consent',
    });
    expect(provider.interactionFinished).not.toHaveBeenCalled();
    expect(result.redirectUrl).toContain('error=access_denied');
  });
});

describe('OidcInteractionService resume', () => {
  it('redirects to hosted error when interaction session is missing', async () => {
    const appEnv = {
      OIDC_ISSUER: 'http://localhost:3010',
      AUTH_FRONTEND_URL: 'http://localhost:3011',
    } as AppEnvService;
    const sessionBridge = {
      resolveAuthenticatedUser: jest.fn().mockResolvedValue({
        user: { id: 'user-1' },
      }),
    } as unknown as OidcUserSessionBridge;
    const service = new OidcInteractionService(
      appEnv,
      sessionBridge,
      {} as OAuthClientRepository,
      {} as OAuthConsentRepository,
      new OidcHostedErrorService(appEnv),
    );
    const provider = {
      interactionDetails: jest.fn().mockRejectedValue(
        Object.assign(new Error('interaction session not found'), {
          name: 'SessionNotFound',
        }),
      ),
      interactionFinished: jest.fn(),
    };
    const { res, getRedirectUrl } = createCapturingInteractionResponse();
    const req = createInteractionRequest('interaction-uid', 'session=test');

    await service.resume(req, res, provider as never);

    expect(provider.interactionDetails).toHaveBeenCalled();
    expect(provider.interactionFinished).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(303);
    const redirectUrl = new URL(getRedirectUrl()!);
    expect(redirectUrl.origin).toBe('http://localhost:3011');
    expect(redirectUrl.pathname).toBe('/oauth/error');
    expect(redirectUrl.searchParams.get('error')).toBe('interaction_expired');
  });

  it('redirects unauthenticated requests without uid to hosted invalid_request error', async () => {
    const appEnv = {
      OIDC_ISSUER: 'http://localhost:3010',
      AUTH_FRONTEND_URL: 'http://localhost:3011',
    } as AppEnvService;
    const sessionBridge = {
      resolveAuthenticatedUser: jest.fn().mockResolvedValue(null),
    } as unknown as OidcUserSessionBridge;
    const service = new OidcInteractionService(
      appEnv,
      sessionBridge,
      {} as OAuthClientRepository,
      {} as OAuthConsentRepository,
      new OidcHostedErrorService(appEnv),
    );
    const { res, getRedirectUrl } = createCapturingInteractionResponse();
    const req = createInteractionRequest('', '');

    await service.resume(req, res, {} as never);

    expect(res.statusCode).toBe(303);
    const redirectUrl = new URL(getRedirectUrl()!);
    expect(redirectUrl.searchParams.get('error')).toBe('invalid_request');
    expect(redirectUrl.searchParams.get('error_description')).toContain(
      'Missing OIDC interaction id',
    );
  });
});

describe('buildRpAbortRedirectUrl', () => {
  it('adds login_required and state on the registered redirect_uri', () => {
    const url = buildRpAbortRedirectUrl({
      redirect_uri: 'http://localhost:3005/api/v1/user/auth/oidc/callback',
      state: 'pkce-state',
    });

    expect(url).toBeDefined();
    const parsed = new URL(url!);
    expect(parsed.origin + parsed.pathname).toBe(
      'http://localhost:3005/api/v1/user/auth/oidc/callback',
    );
    expect(parsed.searchParams.get('error')).toBe('login_required');
    expect(parsed.searchParams.get('state')).toBe('pkce-state');
  });

  it('returns undefined for non-http URIs', () => {
    expect(
      buildRpAbortRedirectUrl({ redirect_uri: 'javascript:alert(1)' }),
    ).toBeUndefined();
  });
});
