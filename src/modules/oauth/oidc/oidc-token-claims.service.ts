import { Injectable } from '@nestjs/common';
import { OidcAccountService } from './oidc-account.service';

type OidcTokenLike = {
  kind?: string;
  accountId?: string;
};

@Injectable()
export class OidcTokenClaimsService {
  constructor(private readonly accountService: OidcAccountService) {}

  extraTokenClaims = async (
    ctx: unknown,
    token: OidcTokenLike,
  ): Promise<Record<string, unknown> | undefined> => {
    if (token.kind !== 'AccessToken' || !token.accountId) {
      return undefined;
    }

    const account = await this.accountService.findAccount(ctx, token.accountId);
    if (!account) {
      return undefined;
    }

    const claims = await account.claims();
    return {
      email: claims.email,
      email_verified: claims.email_verified,
    };
  };
}
