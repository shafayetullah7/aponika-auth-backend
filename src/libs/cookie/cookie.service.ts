import { Injectable } from '@nestjs/common';
import { CookieOptions, Response } from 'express';
import { AppEnvService } from '@/libs/config/app-env.service';
import { parseDurationMs } from '@/libs/utils/parse-duration';

@Injectable()
export class CookieService {
  constructor(private readonly appEnv: AppEnvService) {}

  private getAdminCookieOptions(httpOnly: boolean): CookieOptions {
    const isProduction = this.appEnv.isProduction;

    return {
      httpOnly,
      secure: isProduction,
      sameSite: 'lax',
      domain: isProduction ? this.appEnv.COOKIE_DOMAIN : undefined,
      path: '/',
    };
  }

  setAdminAccessToken(res: Response, token: string): void {
    res.cookie('adminAccessToken', token, {
      ...this.getAdminCookieOptions(true),
      maxAge: parseDurationMs(this.appEnv.JWT_ADMIN_ACCESS_EXP),
    });
  }

  setAdminRefreshToken(res: Response, token: string): void {
    res.cookie('adminRefreshToken', token, {
      ...this.getAdminCookieOptions(true),
      maxAge: this.appEnv.SESSION_MAX_AGE,
    });
  }

  setAdminXsrfToken(res: Response, token: string): void {
    res.cookie('xsrf-token', token, {
      ...this.getAdminCookieOptions(false),
      maxAge: this.appEnv.SESSION_MAX_AGE,
    });
  }

  clearAdminTokens(res: Response): void {
    const accessOptions = {
      ...this.getAdminCookieOptions(true),
      maxAge: parseDurationMs(this.appEnv.JWT_ADMIN_ACCESS_EXP),
    };
    const sessionOptions = {
      ...this.getAdminCookieOptions(true),
      maxAge: this.appEnv.SESSION_MAX_AGE,
    };
    const xsrfOptions = {
      ...this.getAdminCookieOptions(false),
      maxAge: this.appEnv.SESSION_MAX_AGE,
    };

    res.clearCookie('adminAccessToken', accessOptions);
    res.clearCookie('adminRefreshToken', sessionOptions);
    res.clearCookie('xsrf-token', xsrfOptions);
  }

  private getUserCookieOptions(httpOnly: boolean): CookieOptions {
    const isProduction = this.appEnv.isProduction;

    return {
      httpOnly,
      secure: isProduction,
      sameSite: 'lax',
      domain: isProduction ? this.appEnv.COOKIE_DOMAIN : undefined,
      path: '/',
    };
  }

  setUserAccessToken(res: Response, token: string): void {
    res.cookie('userAccessToken', token, {
      ...this.getUserCookieOptions(true),
      maxAge: parseDurationMs(this.appEnv.JWT_USER_ACCESS_EXP),
    });
  }

  setUserRefreshToken(res: Response, token: string): void {
    res.cookie('userRefreshToken', token, {
      ...this.getUserCookieOptions(true),
      maxAge: this.appEnv.SESSION_MAX_AGE,
    });
  }

  setUserXsrfToken(res: Response, token: string): void {
    res.cookie('user-xsrf-token', token, {
      ...this.getUserCookieOptions(false),
      maxAge: this.appEnv.SESSION_MAX_AGE,
    });
  }

  clearUserTokens(res: Response): void {
    const accessOptions = {
      ...this.getUserCookieOptions(true),
      maxAge: parseDurationMs(this.appEnv.JWT_USER_ACCESS_EXP),
    };
    const sessionOptions = {
      ...this.getUserCookieOptions(true),
      maxAge: this.appEnv.SESSION_MAX_AGE,
    };
    const xsrfOptions = {
      ...this.getUserCookieOptions(false),
      maxAge: this.appEnv.SESSION_MAX_AGE,
    };

    res.clearCookie('userAccessToken', accessOptions);
    res.clearCookie('userRefreshToken', sessionOptions);
    res.clearCookie('user-xsrf-token', xsrfOptions);
  }
}
