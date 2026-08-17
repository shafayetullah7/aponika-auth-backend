import { AppEnvService } from '@/libs/config/app-env.service';
import { OAuthConsentRepository } from '@/modules/oauth/oauth-consent.repository';
import { OAuthClientRepository } from '@/modules/oauth/oauth-client.repository';
import { OidcInteractionService } from '../../oidc-interaction.service';
import { OidcUserSessionBridge } from '../../oidc-user-session.bridge';
import { createInteractionRequest } from '../../oidc-interaction-request.util';

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

    const service = new OidcInteractionService(
      {
        OIDC_ISSUER: 'http://localhost:3010',
        AUTH_FRONTEND_URL: 'http://localhost:3011',
      } as AppEnvService,
      {} as OidcUserSessionBridge,
      {} as OAuthClientRepository,
      {} as OAuthConsentRepository,
    );

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
