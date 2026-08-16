import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { I18nService } from 'nestjs-i18n';
import { AuditActionEnum } from '@/_db/drizzle/enum/audit-action.enum';
import { AuditActorTypeEnum } from '@/_db/drizzle/enum/audit-actor-type.enum';
import { PlatformAdminStatusEnum } from '@/_db/drizzle/enum/platform-admin-status.enum';
import { TAdminSession } from '@/_db/drizzle/schema/session/admin-session.schema';
import { TPlatformAdmin } from '@/_db/drizzle/schema/platform-admin/platform-admin.schema';
import { AppEnvService } from '@/libs/config/app-env.service';
import { verifyPassword } from '@/libs/crypto/password';
import { CustomException } from '@/libs/exceptions/custom.exception';
import { ErrorCode } from '@/libs/response/error.schema';
import { DeviceInfo } from '@/libs/utils/parse-device-info';
import { AuditService } from '@/modules/audit/audit.service';
import { AdminSessionService } from '@/modules/session/admin-session.service';
import { AdminLoginRateLimiterService } from './admin-login-rate-limiter.service';
import { LoginLocalAdminInput } from './dto/login-local-admin.dto';
import {
  PlatformAdminLocalAuthRepository,
  PlatformAdminWithLocalAuth,
} from './platform-admin-local-auth.repository';
import {
  AdminRegistrationService,
  PublicPlatformAdmin,
} from './admin-registration.service';

type AdminJwtPayload = {
  sub: string;
  sessionId: string;
  role: 'admin';
};

export type AdminAuthTokens = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class PlatformAdminAuthService {
  constructor(
    private readonly platformAdminLocalAuthRepository: PlatformAdminLocalAuthRepository,
    private readonly adminSessionService: AdminSessionService,
    private readonly adminRegistrationService: AdminRegistrationService,
    private readonly adminLoginRateLimiter: AdminLoginRateLimiterService,
    private readonly auditService: AuditService,
    private readonly jwtService: JwtService,
    private readonly appEnv: AppEnvService,
    private readonly i18n: I18nService,
  ) {}

  requestRegistrationOtp(
    payload: Parameters<AdminRegistrationService['requestRegistrationOtp']>[0],
    lang: string,
  ) {
    return this.adminRegistrationService.requestRegistrationOtp(payload, lang);
  }

  completeRegistration(
    payload: Parameters<AdminRegistrationService['completeRegistration']>[0],
    lang: string,
  ) {
    return this.adminRegistrationService.completeRegistration(payload, lang);
  }

  async login(
    payload: LoginLocalAdminInput,
    deviceInfo: DeviceInfo,
    ip: string,
    lang: string = 'en',
  ): Promise<{
    tokens: AdminAuthTokens;
    admin: PublicPlatformAdmin;
    session: TAdminSession;
  }> {
    const rateLimitKey = `${ip}:${payload.email.toLowerCase()}`;
    this.adminLoginRateLimiter.assertCanAttempt(rateLimitKey, lang);

    const record = await this.platformAdminLocalAuthRepository.findByEmail(
      payload.email,
    );

    if (!record) {
      await this.recordLoginFailure(payload.email, ip, 'not_found', lang);
      this.adminLoginRateLimiter.recordFailedAttempt(rateLimitKey);
      throw this.invalidCredentialsException(lang);
    }

    try {
      await this.assertAdminCanAuthenticate(record, payload.password, lang);
    } catch (error) {
      await this.recordLoginFailure(
        payload.email,
        ip,
        error instanceof CustomException ? error.errorCode ?? 'rejected' : 'rejected',
        lang,
      );
      this.adminLoginRateLimiter.recordFailedAttempt(rateLimitKey);
      throw error;
    }

    const session = await this.adminSessionService.createSession({
      adminId: record.admin.id,
      deviceInfo,
      ip,
    });

    const tokens = await this.issueTokens(record.admin, session);
    await this.adminSessionService.setRefreshTokenHash(
      session.id,
      tokens.refreshToken,
    );
    this.adminLoginRateLimiter.reset(rateLimitKey);

    await this.auditService.record({
      actorType: AuditActorTypeEnum.PLATFORM_ADMIN,
      actorId: record.admin.id,
      action: AuditActionEnum.ADMIN_LOGIN_SUCCESS,
      resourceType: 'platform_admin',
      resourceId: record.admin.id,
      metadata: { email: record.admin.email, sessionId: session.id },
      ip,
      userAgent:
        typeof deviceInfo.userAgent === 'string'
          ? deviceInfo.userAgent
          : undefined,
    });

    return {
      tokens,
      admin: this.toPublicAdmin(record.admin),
      session,
    };
  }

  async refreshTokens(currentRefreshToken: string): Promise<{
    tokens: AdminAuthTokens;
    admin: PublicPlatformAdmin;
    session: TAdminSession;
  }> {
    try {
      const payload = await this.jwtService.verifyAsync<AdminJwtPayload>(
        currentRefreshToken,
        { secret: this.appEnv.JWT_ADMIN_REFRESH_SECRET },
      );

      const sessionWithAdmin = await this.adminSessionService.getSessionWithAdmin(
        payload.sessionId,
      );

      if (!sessionWithAdmin) {
        throw new UnauthorizedException('Invalid session');
      }

      const { session, admin } = sessionWithAdmin;

      if (!this.adminSessionService.isSessionActive(session)) {
        throw new UnauthorizedException('Session revoked or expired');
      }

      const refreshMatches = await verifyPassword(
        currentRefreshToken,
        session.refreshTokenHash,
      );

      if (!refreshMatches) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (admin.status === PlatformAdminStatusEnum.SUSPENDED) {
        throw new UnauthorizedException('Admin suspended');
      }

      const accessToken = await this.signAccessToken(admin.id, session.id);

      return {
        tokens: {
          accessToken,
          refreshToken: currentRefreshToken,
        },
        admin: this.toPublicAdmin(admin),
        session,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(sessionId: string, adminId: string, ip?: string): Promise<void> {
    await this.adminSessionService.revokeSession(sessionId);

    await this.auditService.record({
      actorType: AuditActorTypeEnum.PLATFORM_ADMIN,
      actorId: adminId,
      action: AuditActionEnum.ADMIN_LOGOUT,
      resourceType: 'admin_session',
      resourceId: sessionId,
      ip: ip ?? null,
    });
  }

  private async assertAdminCanAuthenticate(
    record: PlatformAdminWithLocalAuth,
    password: string,
    lang: string,
  ): Promise<void> {
    if (!record.localAuth.verified) {
      throw this.invalidCredentialsException(lang);
    }

    if (record.admin.status === PlatformAdminStatusEnum.SUSPENDED) {
      throw this.invalidCredentialsException(lang);
    }

    const passwordMatches = await verifyPassword(
      password,
      record.localAuth.passwordHash,
    );

    if (!passwordMatches) {
      throw this.invalidCredentialsException(lang);
    }
  }

  private async issueTokens(
    admin: TPlatformAdmin,
    session: TAdminSession,
  ): Promise<AdminAuthTokens> {
    const accessToken = await this.signAccessToken(admin.id, session.id);
    const refreshToken = await this.signRefreshToken(admin.id, session.id);

    return { accessToken, refreshToken };
  }

  private signAccessToken(adminId: string, sessionId: string): Promise<string> {
    const payload: AdminJwtPayload = {
      sub: adminId,
      sessionId,
      role: 'admin',
    };

    return this.jwtService.signAsync(payload, {
      secret: this.appEnv.JWT_ADMIN_ACCESS_SECRET,
      expiresIn: this.appEnv.JWT_ADMIN_ACCESS_EXP as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
  }

  private signRefreshToken(adminId: string, sessionId: string): Promise<string> {
    const payload: AdminJwtPayload = {
      sub: adminId,
      sessionId,
      role: 'admin',
    };

    return this.jwtService.signAsync(payload, {
      secret: this.appEnv.JWT_ADMIN_REFRESH_SECRET,
      expiresIn: this.appEnv.JWT_ADMIN_REFRESH_EXP as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
  }

  private invalidCredentialsException(lang: string): CustomException {
    return new CustomException({
      message: this.i18n.t('message.error.invalidCredentials', { lang }),
      statusCode: HttpStatus.UNAUTHORIZED,
      errorCode: ErrorCode.INVALID_CREDENTIALS,
    });
  }

  private async recordLoginFailure(
    email: string,
    ip: string,
    reason: string,
    lang: string,
  ): Promise<void> {
    await this.auditService.record({
      actorType: AuditActorTypeEnum.SYSTEM,
      action: AuditActionEnum.ADMIN_LOGIN_FAILURE,
      resourceType: 'platform_admin',
      metadata: { email, reason },
      ip,
    });

    void lang;
  }

  private toPublicAdmin(admin: TPlatformAdmin): PublicPlatformAdmin {
    return {
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      userName: admin.userName,
      email: admin.email,
      status: admin.status,
      role: admin.role,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }
}
