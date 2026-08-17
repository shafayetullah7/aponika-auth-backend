import { Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CookieService } from '@/libs/cookie/cookie.service';
import { UserAuthService } from '@/modules/user-auth/user-auth.service';
import type { OidcProviderInstance } from '../provider/oidc-provider.factory';
import { isOidcEndSessionSuccessContext } from '../provider/oidc-provider.types';
import { OidcUserSessionBridge } from '../login/oidc-user-session.bridge';

@Injectable()
export class OidcEndSessionListener {
  private readonly logger = new Logger(OidcEndSessionListener.name);

  constructor(
    private readonly sessionBridge: OidcUserSessionBridge,
    private readonly userAuthService: UserAuthService,
    private readonly cookieService: CookieService,
  ) {}

  attach(provider: OidcProviderInstance): void {
    provider.on('end_session.success', (ctx) => {
      void this.handleEndSessionSuccess(ctx);
    });
  }

  private async handleEndSessionSuccess(ctx: unknown): Promise<void> {
    if (!isOidcEndSessionSuccessContext(ctx)) {
      return;
    }

    const pair = this.readExpressPair(ctx);
    if (!pair) {
      return;
    }

    try {
      const auth = await this.sessionBridge.resolveAuthenticatedUser(
        pair.req,
        pair.res,
      );
      if (!auth) {
        return;
      }

      await this.userAuthService.logout(
        auth.session.id,
        auth.user.id,
        pair.req.ip ?? null,
      );
      this.cookieService.clearUserTokens(pair.res);
    } catch (error: unknown) {
      this.logger.warn(
        'Failed to revoke hosted login session during OIDC end_session',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private readExpressPair(
    ctx: unknown,
  ): { req: Request; res: Response } | null {
    if (!ctx || typeof ctx !== 'object') {
      return null;
    }

    const req = Reflect.get(ctx, 'req');
    const res = Reflect.get(ctx, 'res');

    if (!req || !res) {
      return null;
    }

    return { req: req as Request, res: res as Response };
  }
}
