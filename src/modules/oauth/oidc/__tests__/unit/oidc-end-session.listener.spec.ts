import { JwtService } from '@nestjs/jwt';
import { CookieService } from '@/libs/cookie/cookie.service';
import { UserAuthService } from '@/modules/user-auth/user-auth.service';
import { OidcEndSessionListener } from '../../logout/oidc-end-session.listener';
import {
  readEndSessionAccountId,
  readEndSessionLogoutState,
} from '../../provider/oidc-provider.types';

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

describe('readEndSessionLogoutState', () => {
  it('reads state from oidc params then query', () => {
    expect(
      readEndSessionLogoutState({
        oidc: { params: { state: 'all.abc' } },
        req: { query: { state: 'browser.ignored' } },
      }),
    ).toBe('all.abc');

    expect(
      readEndSessionLogoutState({
        oidc: {},
        req: { query: { state: 'browser.xyz' } },
      }),
    ).toBe('browser.xyz');
  });

  it('reads RP state from oidc session logout details (confirm hop)', () => {
    expect(
      readEndSessionLogoutState({
        oidc: {
          params: { logout: 'yes' },
          session: { state: { state: 'all.from-session', secret: 'xsrf' } },
        },
      }),
    ).toBe('all.from-session');
  });
});

describe('OidcEndSessionListener', () => {
  const userAuthService = {
    logoutAllActiveSessions: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
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

  it('revokes all hosted sessions when state has all. prefix', async () => {
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
      req: { cookies: {}, ip: '127.0.0.1', query: { state: 'all.uuid' } },
      res,
      oidc: {
        params: { state: 'all.uuid' },
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
    expect(userAuthService.logout).not.toHaveBeenCalled();
    expect(clearOrder).toEqual(['clear', 'revoke']);
  });

  it('revokes only the current hosted session for this-browser logout', async () => {
    (jwtService.decode as jest.Mock).mockReturnValue({
      sub: 'cookie-user',
      sessionId: 'session-1',
    });

    attachAndEmit({
      req: {
        cookies: { userAccessToken: 'jwt-token' },
        ip: '10.0.0.1',
        query: { state: 'browser.xyz' },
      },
      res: {},
      oidc: { params: { state: 'browser.xyz' } },
    });

    expect(cookieService.clearUserTokens).toHaveBeenCalled();
    await Promise.resolve();

    expect(userAuthService.logout).toHaveBeenCalledWith(
      'session-1',
      'cookie-user',
      '10.0.0.1',
    );
    expect(userAuthService.logoutAllActiveSessions).not.toHaveBeenCalled();
  });

  it('does not revoke all devices when state is missing', async () => {
    (jwtService.decode as jest.Mock).mockReturnValue({
      sub: 'cookie-user',
      sessionId: 'session-1',
    });

    attachAndEmit({
      req: {
        cookies: { userAccessToken: 'jwt-token' },
        ip: '10.0.0.1',
      },
      res: {},
      oidc: {},
    });

    await Promise.resolve();

    expect(userAuthService.logout).toHaveBeenCalledWith(
      'session-1',
      'cookie-user',
      '10.0.0.1',
    );
    expect(userAuthService.logoutAllActiveSessions).not.toHaveBeenCalled();
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
    expect(userAuthService.logout).not.toHaveBeenCalled();
  });
});
