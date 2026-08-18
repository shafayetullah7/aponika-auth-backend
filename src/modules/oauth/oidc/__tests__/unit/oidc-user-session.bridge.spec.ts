import { JwtService } from '@nestjs/jwt';
import { UserStatusEnum } from '@/_db/drizzle/enum';
import { OidcUserSessionBridge } from '../../login/oidc-user-session.bridge';

describe('OidcUserSessionBridge', () => {
  const userSessionService = {
    getSessionWithUser: jest.fn(),
    isSessionActive: jest.fn(),
  };
  const jwtService = {
    verifyAsync: jest.fn(),
  };
  const cookieService = {
    setUserAccessToken: jest.fn(),
    setUserRefreshToken: jest.fn(),
  };

  const bridge = new OidcUserSessionBridge(
    userSessionService as never,
    {} as never,
    jwtService as unknown as JwtService,
    { JWT_USER_ACCESS_SECRET: 'secret' } as never,
    cookieService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sessionId: 'session-1',
      role: 'user',
    });
  });

  it('returns null when email is not verified', async () => {
    userSessionService.getSessionWithUser.mockResolvedValue({
      user: { id: 'user-1', status: UserStatusEnum.ACTIVE },
      credential: { emailVerified: false },
      session: { id: 'session-1' },
    });
    userSessionService.isSessionActive.mockReturnValue(true);

    const result = await bridge.resolveAuthenticatedUser(
      { cookies: { userAccessToken: 'access' } } as never,
      {} as never,
    );

    expect(result).toBeNull();
  });

  it('returns the session when email is verified', async () => {
    const sessionWithUser = {
      user: { id: 'user-1', status: UserStatusEnum.ACTIVE },
      credential: { emailVerified: true },
      session: { id: 'session-1' },
    };
    userSessionService.getSessionWithUser.mockResolvedValue(sessionWithUser);
    userSessionService.isSessionActive.mockReturnValue(true);

    const result = await bridge.resolveAuthenticatedUser(
      { cookies: { userAccessToken: 'access' } } as never,
      {} as never,
    );

    expect(result).toBe(sessionWithUser);
  });
});
