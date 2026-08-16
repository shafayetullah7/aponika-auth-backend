import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { errors } from 'jose';
import { AppEnvService } from '@/libs/config/app-env.service';
import { JwtResourceGuard } from './jwt-resource.guard';
import { OidcJwksClientService } from './oidc-jwks-client.service';

describe('JwtResourceGuard', () => {
  const jwksClient = {
    verifyAccessToken: jest.fn(),
  };

  const appEnv = {
    OIDC_ISSUER: 'http://localhost:3010',
    OIDC_DEFAULT_RESOURCE: 'http://localhost:3005',
  } as AppEnvService;

  let guard: JwtResourceGuard;

  const createContext = (authorization?: string) => {
    const request: {
      headers: { authorization?: string };
      oidcAccessToken?: unknown;
    } = {
      headers: {},
    };

    if (authorization) {
      request.headers.authorization = authorization;
    }

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      request,
    } as unknown as ExecutionContext & { request: typeof request };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtResourceGuard(
      jwksClient as unknown as OidcJwksClientService,
      appEnv,
    );
  });

  it('rejects requests without a Bearer token', async () => {
    const context = createContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects invalid or expired tokens', async () => {
    jwksClient.verifyAccessToken.mockRejectedValue(
      new errors.JWTExpired('expired', { sub: 'user-1' }),
    );

    const context = createContext('Bearer expired-token');

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      message: 'Invalid or expired access token',
    });
  });

  it('attaches verified token claims to the request', async () => {
    jwksClient.verifyAccessToken.mockResolvedValue({
      payload: {
        sub: 'user-1',
        email: 'user@example.com',
        email_verified: true,
        aud: 'http://localhost:3005',
        iss: 'http://localhost:3010',
      },
    });

    const context = createContext('Bearer valid-token');
    const allowed = await guard.canActivate(context);

    expect(allowed).toBe(true);
    expect(context.request.oidcAccessToken).toEqual({
      sub: 'user-1',
      email: 'user@example.com',
      email_verified: true,
      aud: 'http://localhost:3005',
      iss: 'http://localhost:3010',
      claims: expect.objectContaining({ sub: 'user-1' }),
    });
    expect(jwksClient.verifyAccessToken).toHaveBeenCalledWith('valid-token');
  });
});
