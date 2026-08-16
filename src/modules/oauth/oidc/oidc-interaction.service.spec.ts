import { AppEnvService } from '@/libs/config/app-env.service';
import { OAuthConsentRepository } from '@/modules/oauth/oauth-consent.repository';
import { OAuthClientRepository } from '@/modules/oauth/oauth-client.repository';
import { OidcInteractionService } from './oidc-interaction.service';
import { OidcUserSessionBridge } from './oidc-user-session.bridge';
import { createInteractionRequest } from './oidc-interaction-request.util';

describe('OidcInteractionService denyConsent', () => {
  it('finishes the interaction with access_denied', async () => {
    const interactionFinished = jest
      .fn()
      .mockImplementation(async (_req, res: { setHeader: (k: string, v: string) => void }) => {
        res.setHeader(
          'Location',
          'http://localhost:4000/auth/callback?error=access_denied&state=third-party-state',
        );
      });
    const provider = {
      interactionDetails: jest.fn().mockResolvedValue({
        prompt: { name: 'consent' },
        params: {
          client_id: 'third-party-app',
          redirect_uri: 'http://localhost:4000/auth/callback',
          state: 'third-party-state',
        },
        session: { accountId: 'user-1' },
      }),
      interactionFinished,
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

    expect(interactionFinished).toHaveBeenCalledWith(
      req,
      expect.any(Object),
      {
        error: 'access_denied',
        error_description: 'User denied consent',
      },
      { mergeWithLastSubmission: true },
    );
    expect(result.redirectUrl).toContain('error=access_denied');
  });
});
