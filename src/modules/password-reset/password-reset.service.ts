import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { I18nService } from 'nestjs-i18n';
import { AuditActionEnum } from '@/_db/drizzle/enum/audit-action.enum';
import { AuditActorTypeEnum } from '@/_db/drizzle/enum/audit-actor-type.enum';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import { AppEnvService } from '@/libs/config/app-env.service';
import { hashPassword, verifyPassword } from '@/libs/crypto/password';
import { CustomException } from '@/libs/exceptions/custom.exception';
import { MailService } from '@/libs/mail/mail.service';
import { OTP_EXPIRY_MINUTES } from '@/libs/otp/otp.constants';
import { OtpService } from '@/libs/otp/otp.service';
import { ErrorCode } from '@/libs/response/error.schema';
import { AuditService } from '@/modules/audit/audit.service';
import { IdentityRepository } from '@/modules/identity/identity.repository';
import {
  ConfirmPasswordResetInput,
  RequestPasswordResetInput,
  VerifyPasswordResetOtpInput,
} from './dto/password-reset.dto';
import { PasswordResetAttemptRepository } from './password-reset-attempt.repository';
import { PasswordResetRateLimiterService } from './password-reset-rate-limiter.service';

type ResetTokenPayload = {
  email: string;
  purpose: 'reset-request' | 'reset-access';
};

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly appEnv: AppEnvService,
    private readonly identityRepository: IdentityRepository,
    private readonly attemptRepository: PasswordResetAttemptRepository,
    private readonly rateLimiter: PasswordResetRateLimiterService,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
    private readonly drizzleService: DrizzleService,
    private readonly i18n: I18nService,
  ) {}

  async requestReset(
    payload: RequestPasswordResetInput,
    lang: string = 'en',
    ip?: string | null,
  ): Promise<{ token: string; expiresAt: Date }> {
    const email = payload.email.trim().toLowerCase();
    const rateLimitKey = ip?.trim() || email;

    this.rateLimiter.assertCanRequest(rateLimitKey, lang);
    this.rateLimiter.assertCanSendOtp(email, lang);
    this.rateLimiter.recordRequest(rateLimitKey);

    const existingUser = await this.identityRepository.findByEmail(email);

    if (existingUser) {
      const otp = this.otpService.generateOtp();
      const otpHash = await hashPassword(otp);
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

      await this.attemptRepository.upsertAttempt({
        email,
        otpHash,
        expiresAt,
      });

      this.rateLimiter.recordOtpSent(email);

      try {
        await this.mailService.sendPasswordResetOtp({ to: email, otp });
      } catch (error) {
        console.error('Failed to send password reset OTP email', error);
      }

      await this.auditService.record({
        actorType: AuditActorTypeEnum.USER,
        actorId: existingUser.id,
        action: AuditActionEnum.USER_PASSWORD_RESET_REQUESTED,
        resourceType: 'user',
        resourceId: existingUser.id,
        metadata: { email },
      });
    }

    return this.generateRequestToken(email);
  }

  async verifyOtp(
    payload: VerifyPasswordResetOtpInput,
    lang: string = 'en',
  ): Promise<{ token: string; expiresAt: Date }> {
    const email = await this.verifyRequestToken(payload.token, lang);
    const pending = await this.attemptRepository.findByEmail(email);

    if (!pending || pending.consumedAt) {
      throw this.invalidOtpException(lang);
    }

    await this.verifyPendingOtp(pending, payload.otp, lang);

    return this.generateAccessToken(email);
  }

  async confirmReset(
    payload: ConfirmPasswordResetInput,
    lang: string = 'en',
  ): Promise<void> {
    const email = await this.verifyAccessToken(payload.token, lang);
    const existing = await this.identityRepository.findByEmailWithCredentialAndProfile(
      email,
    );

    if (!existing) {
      throw new CustomException({
        message: this.i18n.t('message.error.invalidCredentials', { lang }),
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: ErrorCode.UNAUTHORIZED,
      });
    }

    const passwordHash = await hashPassword(payload.password);

    await this.drizzleService.transaction(async (tx) => {
      await this.identityRepository.updatePasswordHash(
        existing.user.id,
        passwordHash,
        tx,
      );
      await this.attemptRepository.deleteByEmail(email, tx);

      await this.auditService.record(
        {
          actorType: AuditActorTypeEnum.USER,
          actorId: existing.user.id,
          action: AuditActionEnum.USER_PASSWORD_RESET_COMPLETED,
          resourceType: 'user',
          resourceId: existing.user.id,
          metadata: { email },
        },
        tx,
      );
    });
  }

  private async generateRequestToken(
    email: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const expiresIn = '10m';
    const payload: ResetTokenPayload = { email, purpose: 'reset-request' };
    const token = await this.jwtService.signAsync(payload, {
      secret: this.appEnv.JWT_SECRET_RESET_REQUEST,
      expiresIn,
    });
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    return { token, expiresAt };
  }

  private async generateAccessToken(
    email: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const expiresIn = '5m';
    const payload: ResetTokenPayload = { email, purpose: 'reset-access' };
    const token = await this.jwtService.signAsync(payload, {
      secret: this.appEnv.JWT_SECRET_RESET_ACCESS,
      expiresIn,
    });
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    return { token, expiresAt };
  }

  private async verifyRequestToken(
    token: string,
    lang: string,
  ): Promise<string> {
    try {
      const payload = await this.jwtService.verifyAsync<ResetTokenPayload>(
        token,
        { secret: this.appEnv.JWT_SECRET_RESET_REQUEST },
      );

      if (payload.purpose !== 'reset-request') {
        throw new Error('Invalid token purpose');
      }

      return payload.email;
    } catch {
      throw this.invalidOtpException(lang);
    }
  }

  private async verifyAccessToken(token: string, lang: string): Promise<string> {
    try {
      const payload = await this.jwtService.verifyAsync<ResetTokenPayload>(
        token,
        { secret: this.appEnv.JWT_SECRET_RESET_ACCESS },
      );

      if (payload.purpose !== 'reset-access') {
        throw new Error('Invalid token purpose');
      }

      return payload.email;
    } catch {
      throw new CustomException({
        message: this.i18n.t('message.error.invalidOtp', { lang }),
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: ErrorCode.UNAUTHORIZED,
      });
    }
  }

  private async verifyPendingOtp(
    pending: { otpHash: string; expiresAt: Date },
    otp: string,
    lang: string,
  ): Promise<void> {
    if (!/^\d{6}$/.test(otp)) {
      throw this.invalidOtpException(lang);
    }

    if (pending.expiresAt.getTime() <= Date.now()) {
      throw this.invalidOtpException(lang);
    }

    const isValid = await verifyPassword(otp, pending.otpHash);

    if (!isValid) {
      throw this.invalidOtpException(lang);
    }
  }

  private invalidOtpException(lang: string): CustomException {
    return new CustomException({
      message: this.i18n.t('message.error.invalidOtp', { lang }),
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: ErrorCode.INVALID_OTP,
    });
  }
}
