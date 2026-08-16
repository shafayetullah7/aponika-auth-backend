import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { I18nService } from 'nestjs-i18n';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import { AuditActionEnum } from '@/_db/drizzle/enum/audit-action.enum';
import { AuditActorTypeEnum } from '@/_db/drizzle/enum/audit-actor-type.enum';
import { TUserStatus, UserStatusEnum } from '@/_db/drizzle/enum';
import {
  TUser,
  TUserCredential,
  TUserProfile,
} from '@/_db/drizzle/schema/identity';
import { TUserSession } from '@/_db/drizzle/schema/session/user-session.schema';
import { AppEnvService } from '@/libs/config/app-env.service';
import { hashPassword, verifyPassword } from '@/libs/crypto/password';
import { CustomException } from '@/libs/exceptions/custom.exception';
import { MailService } from '@/libs/mail/mail.service';
import { ErrorCode } from '@/libs/response/error.schema';
import { AuthenticatedUser } from '@/libs/types/authenticated-user.type';
import { DeviceInfo } from '@/libs/utils/parse-device-info';
import { EMAIL_VERIFICATION_EXPIRY_HOURS } from '@/libs/verification/email-verification.constants';
import {
  generateEmailVerificationToken,
  hashEmailVerificationToken,
} from '@/libs/verification/email-verification-token';
import { AuditService } from '@/modules/audit/audit.service';
import { EmailVerificationRepository } from '@/modules/identity/email-verification.repository';
import { IdentityRepository } from '@/modules/identity/identity.repository';
import { UserSessionService } from '@/modules/session/user-session.service';
import { LoginUserInput } from './dto/login-user.dto';
import { RegisterUserInput } from './dto/register-user.dto';
import { VerifyEmailInput } from './dto/verify-email.dto';
import { UserLoginRateLimiterService } from './user-login-rate-limiter.service';
import { UserRegistrationRateLimiterService } from './user-registration-rate-limiter.service';

export type PublicUser = {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  status: TUserStatus;
};

type UserJwtPayload = {
  sub: string;
  sessionId: string;
  role: 'user';
};

export type UserAuthTokens = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class UserAuthService {
  constructor(
    private readonly identityRepository: IdentityRepository,
    private readonly emailVerificationRepository: EmailVerificationRepository,
    private readonly userSessionService: UserSessionService,
    private readonly userLoginRateLimiter: UserLoginRateLimiterService,
    private readonly userRegistrationRateLimiter: UserRegistrationRateLimiterService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly drizzleService: DrizzleService,
    private readonly jwtService: JwtService,
    private readonly appEnv: AppEnvService,
    private readonly i18n: I18nService,
  ) {}

  async register(
    payload: RegisterUserInput,
    lang: string = 'en',
    ip?: string | null,
  ): Promise<PublicUser> {
    const rateLimitKey = ip?.trim() || payload.email.toLowerCase();
    this.userRegistrationRateLimiter.assertCanAttempt(rateLimitKey, lang);
    this.userRegistrationRateLimiter.recordAttempt(rateLimitKey);

    const existing = await this.identityRepository.findByEmail(payload.email);

    if (existing) {
      throw new CustomException({
        message: this.i18n.t('message.error.emailExists', { lang }),
        statusCode: HttpStatus.CONFLICT,
        errorCode: ErrorCode.DUPLICATE_ENTRY,
      });
    }

    const passwordHash = await hashPassword(payload.password);
    const token = generateEmailVerificationToken();
    const tokenHash = hashEmailVerificationToken(token);
    const expiresAt = new Date(
      Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    const created = await this.drizzleService.transaction(async (tx) => {
      const result = await this.identityRepository.createUserWithCredential(
        {
          email: payload.email,
          passwordHash,
          displayName: payload.name,
          emailVerified: false,
        },
        tx,
      );

      await this.emailVerificationRepository.create(
        {
          userId: result.user.id,
          tokenHash,
          expiresAt,
        },
        tx,
      );

      await this.auditService.record(
        {
          actorType: AuditActorTypeEnum.USER,
          actorId: result.user.id,
          action: AuditActionEnum.USER_REGISTERED,
          resourceType: 'user',
          resourceId: result.user.id,
          metadata: { email: result.user.email },
          ip,
        },
        tx,
      );

      return result;
    });

    try {
      await this.mailService.sendEmailVerification({
        to: created.user.email,
        token,
        displayName: created.profile?.displayName ?? undefined,
      });
    } catch (error) {
      console.error('Failed to send email verification message', error);
    }

    return this.toPublicUser(
      created.user,
      created.credential,
      created.profile,
    );
  }

  async verifyEmail(
    payload: VerifyEmailInput,
    lang: string = 'en',
  ): Promise<{ emailVerified: true }> {
    const tokenHash = hashEmailVerificationToken(payload.token);
    const verification =
      await this.emailVerificationRepository.findActiveByTokenHash(tokenHash);

    if (!verification) {
      throw this.invalidVerificationTokenException(lang);
    }

    await this.drizzleService.transaction(async (tx) => {
      const lockedVerification =
        await this.emailVerificationRepository.findActiveByTokenHash(
          tokenHash,
          tx,
        );

      if (!lockedVerification) {
        throw this.invalidVerificationTokenException(lang);
      }

      const credential = await this.identityRepository.findCredentialByUserId(
        lockedVerification.userId,
        tx,
      );

      if (!credential?.emailVerified) {
        await this.identityRepository.markEmailVerified(
          lockedVerification.userId,
          tx,
        );
      }

      await this.emailVerificationRepository.markConsumed(
        lockedVerification.id,
        tx,
      );
    });

    return { emailVerified: true };
  }

  async login(
    payload: LoginUserInput,
    deviceInfo: DeviceInfo,
    ip: string,
    lang: string = 'en',
  ): Promise<{
    tokens: UserAuthTokens;
    user: PublicUser;
    session: TUserSession;
  }> {
    const rateLimitKey = `${ip}:${payload.email.toLowerCase()}`;
    this.userLoginRateLimiter.assertCanAttempt(rateLimitKey, lang);

    const record =
      await this.identityRepository.findByEmailWithCredentialAndProfile(
        payload.email,
      );

    if (!record) {
      await this.recordLoginFailure(payload.email, ip, 'not_found', lang);
      this.userLoginRateLimiter.recordFailedAttempt(rateLimitKey);
      throw this.invalidCredentialsException(lang);
    }

    try {
      await this.assertUserCanAuthenticate(record, payload.password, lang);
    } catch (error) {
      await this.recordLoginFailure(
        payload.email,
        ip,
        error instanceof CustomException ? error.errorCode ?? 'rejected' : 'rejected',
        lang,
      );
      this.userLoginRateLimiter.recordFailedAttempt(rateLimitKey);
      throw error;
    }

    const session = await this.userSessionService.createSession({
      userId: record.user.id,
      deviceInfo,
      ip,
    });

    const tokens = await this.issueTokens(record.user.id, session.id);
    await this.userSessionService.setRefreshTokenHash(
      session.id,
      tokens.refreshToken,
    );
    this.userLoginRateLimiter.reset(rateLimitKey);

    await this.auditService.record({
      actorType: AuditActorTypeEnum.USER,
      actorId: record.user.id,
      action: AuditActionEnum.USER_LOGIN_SUCCESS,
      resourceType: 'user',
      resourceId: record.user.id,
      metadata: { email: record.user.email, sessionId: session.id },
      ip,
      userAgent:
        typeof deviceInfo.userAgent === 'string'
          ? deviceInfo.userAgent
          : undefined,
    });

    return {
      tokens,
      user: this.toPublicUser(record.user, record.credential, record.profile),
      session,
    };
  }

  async refreshTokens(currentRefreshToken: string): Promise<{
    tokens: UserAuthTokens;
    user: PublicUser;
    session: TUserSession;
  }> {
    try {
      const payload = await this.jwtService.verifyAsync<UserJwtPayload>(
        currentRefreshToken,
        { secret: this.appEnv.JWT_USER_REFRESH_SECRET },
      );

      const sessionWithUser = await this.userSessionService.getSessionWithUser(
        payload.sessionId,
      );

      if (!sessionWithUser) {
        throw new UnauthorizedException('Invalid session');
      }

      const { session, user, credential, profile } = sessionWithUser;

      if (!this.userSessionService.isSessionActive(session)) {
        throw new UnauthorizedException('Session revoked or expired');
      }

      const refreshMatches = await verifyPassword(
        currentRefreshToken,
        session.refreshTokenHash,
      );

      if (!refreshMatches) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (user.status === UserStatusEnum.SUSPENDED) {
        throw new UnauthorizedException('User suspended');
      }

      if (!credential.emailVerified) {
        throw new UnauthorizedException('Email not verified');
      }

      const accessToken = await this.signAccessToken(user.id, session.id);
      const refreshToken = await this.signRefreshToken(user.id, session.id);
      await this.userSessionService.setRefreshTokenHash(
        session.id,
        refreshToken,
      );

      return {
        tokens: { accessToken, refreshToken },
        user: this.toPublicUser(user, credential, profile),
        session,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(
    sessionId: string,
    userId: string,
    ip?: string | null,
  ): Promise<void> {
    await this.userSessionService.revokeSession(sessionId);

    await this.auditService.record({
      actorType: AuditActorTypeEnum.USER,
      actorId: userId,
      action: AuditActionEnum.USER_LOGOUT,
      resourceType: 'user_session',
      resourceId: sessionId,
      ip: ip ?? null,
    });
  }

  getCurrentUser(auth: AuthenticatedUser): PublicUser {
    return this.toPublicUser(
      auth.user,
      auth.credential,
      auth.profile,
    );
  }

  private async assertUserCanAuthenticate(
    record: {
      user: TUser;
      credential: TUserCredential;
    },
    password: string,
    lang: string,
  ): Promise<void> {
    if (!record.credential.emailVerified) {
      throw this.invalidCredentialsException(lang);
    }

    if (record.user.status === UserStatusEnum.SUSPENDED) {
      throw this.invalidCredentialsException(lang);
    }

    const passwordMatches = await verifyPassword(
      password,
      record.credential.passwordHash,
    );

    if (!passwordMatches) {
      throw this.invalidCredentialsException(lang);
    }
  }

  private async issueTokens(
    userId: string,
    sessionId: string,
  ): Promise<UserAuthTokens> {
    const accessToken = await this.signAccessToken(userId, sessionId);
    const refreshToken = await this.signRefreshToken(userId, sessionId);

    return { accessToken, refreshToken };
  }

  private signAccessToken(userId: string, sessionId: string): Promise<string> {
    const payload: UserJwtPayload = {
      sub: userId,
      sessionId,
      role: 'user',
    };

    return this.jwtService.signAsync(payload, {
      secret: this.appEnv.JWT_USER_ACCESS_SECRET,
      expiresIn: this.appEnv.JWT_USER_ACCESS_EXP as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
  }

  private signRefreshToken(userId: string, sessionId: string): Promise<string> {
    const payload: UserJwtPayload = {
      sub: userId,
      sessionId,
      role: 'user',
    };

    return this.jwtService.signAsync(payload, {
      secret: this.appEnv.JWT_USER_REFRESH_SECRET,
      expiresIn: this.appEnv.JWT_USER_REFRESH_EXP as `${number}${'s' | 'm' | 'h' | 'd'}`,
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
      action: AuditActionEnum.USER_LOGIN_FAILURE,
      resourceType: 'user',
      metadata: { email, reason },
      ip,
    });

    void lang;
  }

  private invalidVerificationTokenException(lang: string): CustomException {
    return new CustomException({
      message: this.i18n.t('message.error.invalidEmailVerificationToken', {
        lang,
      }),
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: ErrorCode.INVALID_EMAIL_VERIFICATION_TOKEN,
    });
  }

  private toPublicUser(
    user: TUser,
    credential: TUserCredential,
    profile: TUserProfile | null,
  ): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: profile?.displayName ?? null,
      emailVerified: credential.emailVerified,
      status: user.status,
    };
  }
}
