import { Injectable } from '@nestjs/common';
import { AuditActionEnum } from '@/_db/drizzle/enum/audit-action.enum';
import { AuditActorTypeEnum } from '@/_db/drizzle/enum/audit-actor-type.enum';
import { AuditService } from '@/modules/audit/audit.service';
import type { OidcProviderInstance } from './oidc-provider.factory';
import {
  type OidcGrantSuccessContext,
  isOidcGrantSuccessContext,
} from './oidc-provider.types';

@Injectable()
export class OidcTokenAuditListener {
  constructor(private readonly auditService: AuditService) {}

  attach(provider: OidcProviderInstance): void {
    provider.on('grant.success', (ctx) => {
      if (!isOidcGrantSuccessContext(ctx)) {
        return;
      }

      void this.handleGrantSuccess(ctx);
    });
  }

  private async handleGrantSuccess(ctx: OidcGrantSuccessContext): Promise<void> {
    const grantType = ctx.oidc.params.grant_type;
    if (grantType !== 'authorization_code') {
      return;
    }

    const accountId = ctx.oidc.entities?.AccessToken?.accountId;
    const clientId = ctx.oidc.client?.clientId;
    if (!accountId || !clientId) {
      return;
    }

    await this.auditService.record({
      actorType: AuditActorTypeEnum.USER,
      actorId: accountId,
      action: AuditActionEnum.OIDC_TOKEN_ISSUED,
      resourceType: 'oauth_client',
      resourceId: clientId,
      metadata: {
        grantType,
      },
      ip: ctx.ip ?? null,
    });
  }
}
