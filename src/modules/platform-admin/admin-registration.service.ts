import { HttpStatus, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { AuditActionEnum } from '@/_db/drizzle/enum/audit-action.enum';
import { AuditActorTypeEnum } from '@/_db/drizzle/enum/audit-actor-type.enum';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import { TPlatformAdmin } from '@/_db/drizzle/schema/platform-admin/platform-admin.schema';
import { hashPassword, verifyPassword } from '@/libs/crypto/password';
import { AppEnvService } from '@/libs/config/app-env.service';
import { CustomException } from '@/libs/exceptions/custom.exception';
import { MailService } from '@/libs/mail/mail.service';
import { OTP_EXPIRY_MINUTES } from '@/libs/otp/otp.constants';
import { OtpService } from '@/libs/otp/otp.service';
import { ErrorCode } from '@/libs/response/error.schema';
import { AuditService } from '@/modules/audit/audit.service';
import { AdminRegistrationAttemptRepository } from './admin-registration-attempt.repository';
import { AdminRegistrationRateLimiterService } from './admin-registration-rate-limiter.service';
import { CompleteLocalAdminInput } from './dto/complete-local-admin.dto';
import { CreateLocalAdminInput } from './dto/create-local-admin.dto';
import { PlatformAdminLocalAuthRepository } from './platform-admin-local-auth.repository';
import { PlatformAdminRepository } from './platform-admin.repository';

export type PublicPlatformAdmin = Pick<
  TPlatformAdmin,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'userName'
  | 'email'
  | 'status'
  | 'role'
  | 'createdAt'
  | 'updatedAt'
>;

@Injectable()
export class AdminRegistrationService {
  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly platformAdminRepository: PlatformAdminRepository,
    private readonly platformAdminLocalAuthRepository: PlatformAdminLocalAuthRepository,
    private readonly attemptRepository: AdminRegistrationAttemptRepository,
    private readonly rateLimiter: AdminRegistrationRateLimiterService,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
    private readonly appEnv: AppEnvService,
    private readonly auditService: AuditService,
    private readonly i18n: I18nService,
  ) {}

  async requestRegistrationOtp(
    payload: CreateLocalAdminInput,
    lang: string = 'en',
  ): Promise<{ expiresAt: Date }> {
    const { email, firstName, lastName, password, userName } = payload;

    await this.assertEmailAvailable(email, lang);
    await this.assertUserNameAvailable(userName, email, lang);

    const passwordHash = await hashPassword(password);
    const otp = this.otpService.generateOtp();
    const otpHash = await hashPassword(otp);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    await this.drizzleService.transaction(async (tx) => {
      await this.rateLimiter.assertCanSendOtp(tx, lang);

      await this.attemptRepository.upsertPendingRegistration(
        {
          email,
          userName,
          firstName,
          lastName,
          passwordHash,
          otpHash,
          expiresAt,
        },
        tx,
      );

      await this.rateLimiter.recordOtpSent(tx);
    });

    try {
      await this.mailService.sendAdminRegistrationOtp({
        to: this.appEnv.ADMIN_REGISTRATION_OTP_EMAIL,
        otp,
        registrantEmail: email,
        registrantUserName: userName,
        registrantName: `${firstName} ${lastName}`,
      });
    } catch (error) {
      // OTP is already persisted; email failure must not roll back the attempt.
      console.error('Failed to send admin registration OTP email', error);
    }

    return { expiresAt };
  }

  async completeRegistration(
    payload: CompleteLocalAdminInput,
    lang: string = 'en',
  ): Promise<PublicPlatformAdmin> {
    const pending = await this.attemptRepository.findByEmail(payload.email);

    if (!pending) {
      throw this.invalidOtpException(lang);
    }

    this.assertPayloadMatchesPending(payload, pending, lang);

    const passwordMatches = await verifyPassword(
      payload.password,
      pending.passwordHash,
    );

    if (!passwordMatches) {
      throw this.invalidOtpException(lang);
    }

    const admin = await this.drizzleService.transaction(async (tx) => {
      const lockedPending = await this.attemptRepository.findByEmail(
        payload.email,
        tx,
      );

      if (!lockedPending) {
        throw this.invalidOtpException(lang);
      }

      await this.verifyPendingOtp(lockedPending, payload.otp, lang);

      const createdAdmin = await this.platformAdminRepository.insert(
        {
          firstName: lockedPending.firstName,
          lastName: lockedPending.lastName,
          userName: lockedPending.userName,
          email: lockedPending.email,
        },
        tx,
      );

      await this.platformAdminLocalAuthRepository.insert(
        {
          adminId: createdAdmin.id,
          passwordHash: lockedPending.passwordHash,
          verified: true,
        },
        tx,
      );

      await this.attemptRepository.deleteByEmail(lockedPending.email, tx);

      await this.auditService.record(
        {
          actorType: AuditActorTypeEnum.PLATFORM_ADMIN,
          actorId: createdAdmin.id,
          action: AuditActionEnum.ADMIN_REGISTRATION_COMPLETED,
          resourceType: 'platform_admin',
          resourceId: createdAdmin.id,
          metadata: { email: createdAdmin.email, userName: createdAdmin.userName },
        },
        tx,
      );

      return createdAdmin;
    });

    return this.toPublicAdmin(admin);
  }

  private async assertEmailAvailable(
    email: string,
    lang: string,
  ): Promise<void> {
    const existing = await this.platformAdminRepository.findByEmail(email);

    if (existing) {
      throw new CustomException({
        message: this.i18n.t('message.error.emailExists', { lang }),
        statusCode: HttpStatus.CONFLICT,
        errorCode: ErrorCode.DUPLICATE_ENTRY,
      });
    }
  }

  private async assertUserNameAvailable(
    userName: string,
    email: string,
    lang: string,
  ): Promise<void> {
    const existingAdmin =
      await this.platformAdminRepository.findByUserName(userName);

    if (existingAdmin) {
      throw new CustomException({
        message: this.i18n.t('message.error.usernameExists', { lang }),
        statusCode: HttpStatus.CONFLICT,
        errorCode: ErrorCode.DUPLICATE_ENTRY,
      });
    }

    const pendingConflict =
      await this.attemptRepository.findByUserNameExcludingEmail(
        userName,
        email,
      );

    if (pendingConflict) {
      throw new CustomException({
        message: this.i18n.t('message.error.usernameExists', { lang }),
        statusCode: HttpStatus.CONFLICT,
        errorCode: ErrorCode.DUPLICATE_ENTRY,
      });
    }
  }

  private assertPayloadMatchesPending(
    payload: CompleteLocalAdminInput,
    pending: {
      firstName: string;
      lastName: string;
      userName: string;
    },
    lang: string,
  ): void {
    const mismatch =
      payload.firstName !== pending.firstName ||
      payload.lastName !== pending.lastName ||
      payload.userName !== pending.userName;

    if (mismatch) {
      throw this.invalidOtpException(lang);
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
