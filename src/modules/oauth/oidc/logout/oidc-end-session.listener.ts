import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { CookieService } from '@/libs/cookie/cookie.service';
import { UserAuthService } from '@/modules/user-auth/user-auth.service';
import type { OidcProviderInstance } from '../provider/oidc-provider.factory';
import {
  isOidcEndSessionSuccessContext,
  readEndSessionAccountId,
  readOidcExpressPair,
} from '../provider/oidc-provider.types';

@Injectable()
export class OidcEndSessionListener {
  private readonly logger = new Logger(OidcEndSessionListener.name);

  constructor(
    private readonly userAuthService: UserAuthService,
    private readonly cookieService: CookieService,
    private readonly jwtService: JwtService,
  ) {}

  attach(provider: OidcProviderInstance): void {
    provider.on('end_session.success', (ctx) => {
      this.handleEndSessionSuccess(ctx);
    });
  }

  private handleEndSessionSuccess(ctx: unknown): void {
    if (!isOidcEndSessionSuccessContext(ctx)) {
      return;
    }

    const pair = readOidcExpressPair(ctx);
    if (!pair) {
      return;
    }

    const req = pair.req as Request;
    const res = pair.res as Response;
    const accountId =
      readEndSessionAccountId(ctx) ?? this.readUserIdFromAccessCookie(req);

    // Clear cookies synchronously — oidc-provider redirects immediately after emit.
    this.cookieService.clearUserTokens(res);

    if (!accountId) {
      return;
    }

    void this.revokeHostedSessions(accountId, req.ip ?? ctx.ip ?? null);
  }

  private readUserIdFromAccessCookie(req: Request): string | undefined {
    const raw = req.cookies?.userAccessToken;
    if (typeof raw !== 'string' || !raw.trim()) {
      return undefined;
    }

    const decoded = this.jwtService.decode(raw.trim()) as { sub?: string } | null;
    return typeof decoded?.sub === 'string' ? decoded.sub : undefined;
  }

  private async revokeHostedSessions(
    userId: string,
    ip: string | null,
  ): Promise<void> {
    try {
      await this.userAuthService.logoutAllActiveSessions(userId, ip);
    } catch (error: unknown) {
      this.logger.warn(
        'Failed to revoke hosted login session during OIDC end_session',
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
