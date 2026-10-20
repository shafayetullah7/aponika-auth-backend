import { CookieService } from '@/libs/cookie/cookie.service';
import type { AppEnvService } from '@/libs/config/app-env.service';
import type { CookieOptions, Response } from 'express';

type CookieCall = [string, string, CookieOptions];
type ClearCall = [string, CookieOptions];

const IDENTITY_KEYS = [
  'httpOnly',
  'secure',
  'sameSite',
  'domain',
  'path',
] as const;

function identitySlice(options: CookieOptions): Record<string, unknown> {
  return Object.fromEntries(
    IDENTITY_KEYS.map((key) => [key, options[key]]),
  );
}

function createMockRes() {
  const cookieCalls: CookieCall[] = [];
  const clearCalls: ClearCall[] = [];
  const res = {
    cookie: jest.fn((name: string, value: string, options: CookieOptions) => {
      cookieCalls.push([name, value, options]);
    }),
    clearCookie: jest.fn((name: string, options: CookieOptions) => {
      clearCalls.push([name, options]);
    }),
  };
  return { res: res as unknown as Response, cookieCalls, clearCalls };
}

function createService(
  overrides: Partial<{ COOKIE_DOMAIN: string; isProduction: boolean }> = {},
): CookieService {
  const appEnv = {
    COOKIE_DOMAIN: overrides.COOKIE_DOMAIN ?? 'localhost',
    isProduction: overrides.isProduction ?? false,
    SESSION_MAX_AGE: 86_400_000,
    JWT_USER_ACCESS_EXP: '15m',
  };
  return new CookieService(appEnv as unknown as AppEnvService);
}

function findCookie(
  calls: CookieCall[],
  name: string,
): CookieOptions | undefined {
  return calls.find(([n]) => n === name)?.[2];
}

function findClear(calls: ClearCall[], name: string): CookieOptions | undefined {
  return calls.find(([n]) => n === name)?.[1];
}

describe('CookieService user set/clear parity', () => {
  it('clears user tokens with the same identity options used on set', () => {
    const service = createService({ COOKIE_DOMAIN: 'localhost' });
    const { res, cookieCalls, clearCalls } = createMockRes();

    service.setUserAccessToken(res, 'access');
    service.setUserRefreshToken(res, 'refresh');
    service.setUserXsrfToken(res, 'xsrf');
    service.clearUserTokens(res);

    const pairs: Array<[string, string]> = [
      ['userAccessToken', 'userAccessToken'],
      ['userRefreshToken', 'userRefreshToken'],
      ['user-xsrf-token', 'user-xsrf-token'],
    ];

    for (const [setName, clearName] of pairs) {
      const setOpts = findCookie(cookieCalls, setName);
      const clearOpts = findClear(clearCalls, clearName);
      expect(setOpts).toBeDefined();
      expect(clearOpts).toBeDefined();
      expect(identitySlice(clearOpts!)).toEqual(identitySlice(setOpts!));
      expect(setOpts!.domain).toBe('localhost');
    }
  });

  it('omits domain on set and clear when COOKIE_DOMAIN is empty', () => {
    const service = createService({ COOKIE_DOMAIN: '' });
    const { res, cookieCalls, clearCalls } = createMockRes();

    service.setUserAccessToken(res, 'access');
    service.clearUserTokens(res);

    const setOpts = findCookie(cookieCalls, 'userAccessToken')!;
    const clearOpts = findClear(clearCalls, 'userAccessToken')!;
    expect(setOpts.domain).toBeUndefined();
    expect(clearOpts.domain).toBeUndefined();
    expect(identitySlice(clearOpts)).toEqual(identitySlice(setOpts));
  });
});
