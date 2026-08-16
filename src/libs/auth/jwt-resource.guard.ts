import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AppEnvService } from '@/libs/config/app-env.service';
import { OidcJwksClientService } from '@/libs/auth/oidc-jwks-client.service';
import {
  OidcAccessTokenContext,
  RequestWithOidcAccessToken,
} from '@/libs/types/oidc-access-token.type';

function extractBearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

@Injectable()
export class JwtResourceGuard implements CanActivate {
  constructor(
    private readonly jwksClient: OidcJwksClientService,
    private readonly appEnv: AppEnvService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & RequestWithOidcAccessToken>();

    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Bearer token required');
    }

    try {
      const { payload } = await this.jwksClient.verifyAccessToken(token);

      if (!payload.sub || typeof payload.sub !== 'string') {
        throw new UnauthorizedException('Invalid access token');
      }

      const contextToken: OidcAccessTokenContext = {
        sub: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        email_verified:
          typeof payload.email_verified === 'boolean'
            ? payload.email_verified
            : undefined,
        aud:
          payload.aud ??
          this.appEnv.OIDC_DEFAULT_RESOURCE,
        iss:
          typeof payload.iss === 'string'
            ? payload.iss
            : this.appEnv.OIDC_ISSUER,
        claims: payload,
      };

      request.oidcAccessToken = contextToken;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
