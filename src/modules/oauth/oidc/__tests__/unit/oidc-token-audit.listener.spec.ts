import { AuditActionEnum } from '@/_db/drizzle/enum/audit-action.enum';
import { AuditActorTypeEnum } from '@/_db/drizzle/enum/audit-actor-type.enum';
import { AuditService } from '@/modules/audit/audit.service';
import { OAuthClientRepository } from '@/modules/oauth/repositories/oauth-client.repository';
import { OidcTokenAuditListener } from '../../token/oidc-token-audit.listener';

describe('OidcTokenAuditListener', () => {
  it('records token issuance with the OAuth client UUID, not client_id', async () => {
    const auditService = {
      record: jest.fn().mockResolvedValue({ id: 'audit-event-1' }),
    } as unknown as AuditService;

    const oauthClientRepository = {
      findByClientId: jest.fn().mockResolvedValue({
        id: 'client-uuid',
        clientId: 'byte-forge-web',
      }),
    } as unknown as OAuthClientRepository;

    const listener = new OidcTokenAuditListener(
      auditService,
      oauthClientRepository,
    );

    const provider = {
      on: jest.fn((_event: string, handler: (ctx: unknown) => void) => {
        void handler({
          oidc: {
            params: { grant_type: 'authorization_code' },
            client: { clientId: 'byte-forge-web' },
            entities: {
              AccessToken: { accountId: 'user-uuid' },
            },
          },
          ip: '127.0.0.1',
        });
      }),
    };

    listener.attach(provider as never);

    await Promise.resolve();

    expect(oauthClientRepository.findByClientId).toHaveBeenCalledWith(
      'byte-forge-web',
    );
    expect(auditService.record).toHaveBeenCalledWith({
      actorType: AuditActorTypeEnum.USER,
      actorId: 'user-uuid',
      action: AuditActionEnum.OIDC_TOKEN_ISSUED,
      resourceType: 'oauth_client',
      resourceId: 'client-uuid',
      metadata: {
        clientId: 'byte-forge-web',
        grantType: 'authorization_code',
      },
      ip: '127.0.0.1',
    });
  });
});
