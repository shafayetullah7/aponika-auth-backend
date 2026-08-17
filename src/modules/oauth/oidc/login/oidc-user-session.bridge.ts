import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { UserStatusEnum } from '@/_db/drizzle/enum';
import { AppEnvService } from '@/libs/config/app-env.service';
import { CookieService } from '@/libs/cookie/cookie.service';
import { AuthenticatedUser } from '@/libs/types/authenticated-user.type';
import { UserSessionService } from '@/modules/session/user-session.service';
import { UserAuthService } from '@/modules/user-auth/user-auth.service';

type UserJwtPayload = {
  sub: string;
  sessionId: string;
  role: string;
};

@Injectable()
export class OidcUserSessionBridge {
  constructor(
    private readonly userSessionService: UserSessionService,
    private readonly userAuthService: UserAuthService,
    private readonly jwtService: JwtService,
    private readonly appEnv: AppEnvService,
    private readonly cookieService: CookieService,
  ) {}

  async resolveAuthenticatedUser(
    request: Request,
    response: Response,
  ): Promise<AuthenticatedUser | null> {
    try {
      const payload = await this.resolveJwtPayload(request, response);
      const sessionWithUser = await this.userSessionService.getSessionWithUser(
        payload.sessionId,
      );

      if (
        !sessionWithUser ||
        !this.userSessionService.isSessionActive(sessionWithUser.session)
      ) {
        return null;
      }

      if (sessionWithUser.user.status === UserStatusEnum.SUSPENDED) {
        return null;
      }

      if (!sessionWithUser.credential.emailVerified) {
        return null;
      }

      return sessionWithUser;
    } catch {
      return null;
    }
  }

  private async resolveJwtPayload(
    request: Request,
    response: Response,
  ): Promise<UserJwtPayload> {
    const accessToken = request.cookies?.userAccessToken as string | undefined;
    const refreshToken = request.cookies?.userRefreshToken as
      | string
      | undefined;

    if (accessToken) {
      try {
        return await this.jwtService.verifyAsync<UserJwtPayload>(accessToken, {
          secret: this.appEnv.JWT_USER_ACCESS_SECRET,
        });
      } catch {
        // fall through to refresh
      }
    }

    if (!refreshToken) {
      throw new Error('Authentication required');
    }

    const refreshResult =
      await this.userAuthService.refreshTokens(refreshToken);

    this.cookieService.setUserAccessToken(
      response,
      refreshResult.tokens.accessToken,
    );
    this.cookieService.setUserRefreshToken(
      response,
      refreshResult.tokens.refreshToken,
    );

    return this.jwtService.verifyAsync<UserJwtPayload>(
      refreshResult.tokens.accessToken,
      { secret: this.appEnv.JWT_USER_ACCESS_SECRET },
    );
  }
}
