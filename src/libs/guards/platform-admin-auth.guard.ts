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
import { AuthenticatedPlatformAdmin } from '@/libs/types/authenticated-platform-admin.type';
import { AdminSessionService } from '@/modules/session/admin-session.service';
import { PlatformAdminAuthService } from '@/modules/platform-admin/platform-admin-auth.service';

type AdminJwtPayload = {
  sub: string;
  sessionId: string;
  role: string;
};

type RequestWithAdmin = Request & {
  platformAdmin?: AuthenticatedPlatformAdmin;
};

@Injectable()
export class PlatformAdminAuthGuard implements CanActivate {
  constructor(
    private readonly adminSessionService: AdminSessionService,
    private readonly platformAdminAuthService: PlatformAdminAuthService,
    private readonly jwtService: JwtService,
    private readonly appEnv: AppEnvService,
    private readonly cookieService: CookieService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const response = context.switchToHttp().getResponse<Response>();

    this.assertCsrf(request);

    const payload = await this.resolveJwtPayload(request, response);
    const sessionWithAdmin = await this.adminSessionService.getSessionWithAdmin(
      payload.sessionId,
    );

    if (!sessionWithAdmin) {
      throw new UnauthorizedException('Invalid session');
    }

    if (!this.adminSessionService.isSessionActive(sessionWithAdmin.session)) {
      throw new UnauthorizedException('Session expired');
    }

    request.platformAdmin = sessionWithAdmin;
    return true;
  }

  private assertCsrf(request: Request): void {
    const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    if (!stateChangingMethods.includes(request.method)) {
      return;
    }

    const xsrfCookie = request.cookies?.['xsrf-token'] as string | undefined;
    const xsrfHeader = request.headers?.['x-xsrf-token'] as string | undefined;

    if (!xsrfCookie || !xsrfHeader || xsrfCookie !== xsrfHeader) {
      throw new ForbiddenException('Invalid CSRF token');
    }
  }

  private async resolveJwtPayload(
    request: Request,
    response: Response,
  ): Promise<AdminJwtPayload> {
    const accessToken = request.cookies?.adminAccessToken as string | undefined;
    const refreshToken = request.cookies?.adminRefreshToken as
      | string
      | undefined;

    if (accessToken) {
      try {
        return await this.jwtService.verifyAsync<AdminJwtPayload>(accessToken, {
          secret: this.appEnv.JWT_ADMIN_ACCESS_SECRET,
        });
      } catch {
        // fall through to refresh
      }
    }

    if (!refreshToken) {
      throw new UnauthorizedException('Authentication required');
    }

    const refreshResult =
      await this.platformAdminAuthService.refreshTokens(refreshToken);

    this.cookieService.setAdminAccessToken(
      response,
      refreshResult.tokens.accessToken,
    );

    return this.jwtService.verifyAsync<AdminJwtPayload>(
      refreshResult.tokens.accessToken,
      { secret: this.appEnv.JWT_ADMIN_ACCESS_SECRET },
    );
  }
}
