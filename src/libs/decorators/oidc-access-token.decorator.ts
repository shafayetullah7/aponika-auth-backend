import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  OidcAccessTokenContext,
  RequestWithOidcAccessToken,
} from '@/libs/types/oidc-access-token.type';

export const OidcAccessToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OidcAccessTokenContext => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & RequestWithOidcAccessToken>();

    if (!request.oidcAccessToken) {
      throw new UnauthorizedException('OIDC access token required');
    }

    return request.oidcAccessToken;
  },
);
