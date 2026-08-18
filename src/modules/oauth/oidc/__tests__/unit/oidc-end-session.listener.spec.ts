import { JwtService } from '@nestjs/jwt';
import { CookieService } from '@/libs/cookie/cookie.service';
import { UserAuthService } from '@/modules/user-auth/user-auth.service';
import { OidcEndSessionListener } from '../../logout/oidc-end-session.listener';
import { readEndSessionAccountId } from '../../provider/oidc-provider.types';

describe('readEndSessionAccountId', () => {
  it('reads accountId from oidc session', () => {
    expect(
      readEndSessionAccountId({
        oidc: { session: { accountId: 'user-from-session' } },
      }),
    ).toBe('user-from-session');
  });

  it('reads sub from id_token_hint entity', () => {
    expect(
      readEndSessionAccountId({
        oidc: {
          entities: {
            IdTokenHint: { payload: { sub: 'user-from-hint' } },
          },
        },
      }),
    ).toBe('user-from-hint');
  });

  it('prefers oidc session accountId over id_token_hint', () => {
    expect(
      readEndSessionAccountId({
        oidc: {
          session: { accountId: 'session-user' },
          entities: {
            IdTokenHint: { payload: { sub: 'hint-user' } },
          },
        },
      }),
    ).toBe('session-user');
  });
});

describe('OidcEndSessionListener', () => {
  const userAuthService = {
    logoutAllActiveSessions: jest.fn().mockResolvedValue(undefined),
  } as unknown as UserAuthService;

  const cookieService = {
    clearUserTokens: jest.fn(),
  } as unknown as CookieService;

  const jwtService = {
    decode: jest.fn(),
  } as unknown as JwtService;

  const listener = new OidcEndSessionListener(
    userAuthService,
    cookieService,
    jwtService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function attachAndEmit(ctx: unknown): void {
    const provider = {
      on: jest.fn((_event: string, handler: (value: unknown) => void) => {
        handler(ctx);
      }),
    };
    listener.attach(provider as never);
  }

  it('clears cookies synchronously and revokes sessions by id_token_hint sub', async () => {
    const res = { headersSent: false };
    const clearOrder: string[] = [];

    (cookieService.clearUserTokens as jest.Mock).mockImplementation(() => {
      clearOrder.push('clear');
    });
    (userAuthService.logoutAllActiveSessions as jest.Mock).mockImplementation(
      async () => {
        await Promise.resolve();
        clearOrder.push('revoke');
      },
    );

    attachAndEmit({
      ip: '127.0.0.1',
      req: { cookies: {}, ip: '127.0.0.1' },
      res,
      oidc: {
        entities: {
          IdTokenHint: { payload: { sub: 'user-uuid' } },
        },
      },
    });

    expect(cookieService.clearUserTokens).toHaveBeenCalledWith(res);
    expect(clearOrder).toEqual(['clear']);

    await Promise.resolve();

    expect(userAuthService.logoutAllActiveSessions).toHaveBeenCalledWith(
      'user-uuid',
      '127.0.0.1',
    );
    expect(clearOrder).toEqual(['clear', 'revoke']);
  });

  it('falls back to access cookie sub when oidc context has no account id', async () => {
    (jwtService.decode as jest.Mock).mockReturnValue({ sub: 'cookie-user' });

    attachAndEmit({
      req: {
        cookies: { userAccessToken: 'jwt-token' },
        ip: '10.0.0.1',
      },
      res: {},
      oidc: {},
    });

    expect(cookieService.clearUserTokens).toHaveBeenCalled();
    expect(jwtService.decode).toHaveBeenCalledWith('jwt-token');

    await Promise.resolve();

    expect(userAuthService.logoutAllActiveSessions).toHaveBeenCalledWith(
      'cookie-user',
      '10.0.0.1',
    );
  });

  it('clears cookies even when no account id can be resolved', async () => {
    attachAndEmit({
      req: { cookies: {}, ip: '127.0.0.1' },
      res: {},
      oidc: {},
    });

    expect(cookieService.clearUserTokens).toHaveBeenCalled();

    await Promise.resolve();

    expect(userAuthService.logoutAllActiveSessions).not.toHaveBeenCalled();
  });
});
