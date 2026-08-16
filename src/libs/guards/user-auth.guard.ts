import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
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

type RequestWithUser = Request & {
  authenticatedUser?: AuthenticatedUser;
};

@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(
    private readonly userSessionService: UserSessionService,
    private readonly userAuthService: UserAuthService,
    private readonly jwtService: JwtService,
    private readonly appEnv: AppEnvService,
    private readonly cookieService: CookieService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse<Response>();

    this.assertCsrf(request);

    const payload = await this.resolveJwtPayload(request, response);
    const sessionWithUser = await this.userSessionService.getSessionWithUser(
      payload.sessionId,
    );

    if (!sessionWithUser) {
      throw new UnauthorizedException('Invalid session');
    }

    if (!this.userSessionService.isSessionActive(sessionWithUser.session)) {
      throw new UnauthorizedException('Session expired');
    }

    request.authenticatedUser = sessionWithUser;
    return true;
  }

  private assertCsrf(request: Request): void {
    const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    if (!stateChangingMethods.includes(request.method)) {
      return;
    }

    const xsrfCookie = request.cookies?.['user-xsrf-token'] as
      | string
      | undefined;
    const xsrfHeader = request.headers?.['x-xsrf-token'] as string | undefined;

    if (!xsrfCookie || !xsrfHeader || xsrfCookie !== xsrfHeader) {
      throw new ForbiddenException('Invalid CSRF token');
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
      throw new UnauthorizedException('Authentication required');
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
