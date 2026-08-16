import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedPlatformAdmin } from '@/libs/types/authenticated-platform-admin.type';

type RequestWithAdmin = Request & {
  platformAdmin?: AuthenticatedPlatformAdmin;
};

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedPlatformAdmin => {
    const request = ctx.switchToHttp().getRequest<RequestWithAdmin>();

    if (!request.platformAdmin?.session) {
      throw new UnauthorizedException('Authentication required');
    }

    return request.platformAdmin;
  },
);
