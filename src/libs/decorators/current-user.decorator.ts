import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '@/libs/types/authenticated-user.type';

type RequestWithUser = Request & {
  authenticatedUser?: AuthenticatedUser;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();

    if (!request.authenticatedUser?.session) {
      throw new UnauthorizedException('Authentication required');
    }

    return request.authenticatedUser;
  },
);
