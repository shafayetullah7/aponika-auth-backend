import { Injectable, Logger } from '@nestjs/common';
import { AuditActionEnum } from '@/_db/drizzle/enum/audit-action.enum';
import { AuditActorTypeEnum } from '@/_db/drizzle/enum/audit-actor-type.enum';
import { AuditService } from '@/modules/audit/audit.service';
import { OAuthClientRepository } from '@/modules/oauth/oauth-client.repository';
import type { OidcProviderInstance } from './oidc-provider.factory';
import {
  type OidcGrantSuccessContext,
  isOidcGrantSuccessContext,
} from './oidc-provider.types';

@Injectable()
export class OidcTokenAuditListener {
  private readonly logger = new Logger(OidcTokenAuditListener.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly oauthClientRepository: OAuthClientRepository,
  ) {}

  attach(provider: OidcProviderInstance): void {
    provider.on('grant.success', (ctx) => {
      if (!isOidcGrantSuccessContext(ctx)) {
        return;
      }

      void this.handleGrantSuccess(ctx).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to record OIDC token audit event: ${message}`);
      });
    });
  }

  private async handleGrantSuccess(ctx: OidcGrantSuccessContext): Promise<void> {
    const grantType = ctx.oidc.params.grant_type;
    if (grantType !== 'authorization_code' && grantType !== 'refresh_token') {
      return;
    }

    const accountId = ctx.oidc.entities?.AccessToken?.accountId;
    const clientId = ctx.oidc.client?.clientId;
    if (!accountId || !clientId) {
      return;
    }

    const client = await this.oauthClientRepository.findByClientId(clientId);
    if (!client) {
      this.logger.warn(
        `Skipping OIDC token audit: OAuth client "${clientId}" is not registered`,
      );
      return;
    }

    await this.auditService.record({
      actorType: AuditActorTypeEnum.USER,
      actorId: accountId,
      action: AuditActionEnum.OIDC_TOKEN_ISSUED,
      resourceType: 'oauth_client',
      resourceId: client.id,
      metadata: {
        clientId,
        grantType,
      },
      ip: ctx.ip ?? null,
    });
  }
}
