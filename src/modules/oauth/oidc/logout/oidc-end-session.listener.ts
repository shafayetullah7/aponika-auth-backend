import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { CookieService } from '@/libs/cookie/cookie.service';
import { UserAuthService } from '@/modules/user-auth/user-auth.service';
import type { OidcProviderInstance } from '../provider/oidc-provider.factory';
import {
  isAllDevicesLogoutState,
  isOidcEndSessionSuccessContext,
  readEndSessionAccountId,
  readEndSessionLogoutState,
  readOidcExpressPair,
} from '../provider/oidc-provider.types';

type HostedAccessPayload = {
  sub?: string;
  sessionId?: string;
};

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
    const hosted = this.readHostedAccessPayload(req);
    const accountId =
      readEndSessionAccountId(ctx) ?? hosted?.sub;

    // Clear cookies synchronously — oidc-provider redirects immediately after emit.
    this.cookieService.clearUserTokens(res);

    if (!accountId) {
      return;
    }

    const ip = req.ip ?? ctx.ip ?? null;
    const logoutState = readEndSessionLogoutState(ctx);

    if (isAllDevicesLogoutState(logoutState)) {
      void this.revokeAllHostedSessions(accountId, ip);
      return;
    }

    if (hosted?.sessionId) {
      void this.revokeCurrentHostedSession(hosted.sessionId, accountId, ip);
    }
  }

  private readHostedAccessPayload(req: Request): HostedAccessPayload | undefined {
    const raw = req.cookies?.userAccessToken;
    if (typeof raw !== 'string' || !raw.trim()) {
      return undefined;
    }

    const decoded = this.jwtService.decode(raw.trim()) as HostedAccessPayload | null;
    if (!decoded || typeof decoded !== 'object') {
      return undefined;
    }

    return {
      sub: typeof decoded.sub === 'string' ? decoded.sub : undefined,
      sessionId:
        typeof decoded.sessionId === 'string' ? decoded.sessionId : undefined,
    };
  }

  private async revokeCurrentHostedSession(
    sessionId: string,
    userId: string,
    ip: string | null,
  ): Promise<void> {
    try {
      await this.userAuthService.logout(sessionId, userId, ip);
    } catch (error: unknown) {
      this.logger.warn(
        'Failed to revoke current hosted login session during OIDC end_session',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private async revokeAllHostedSessions(
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
