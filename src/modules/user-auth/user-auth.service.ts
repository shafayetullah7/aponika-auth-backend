import { HttpStatus, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import { AuditActionEnum } from '@/_db/drizzle/enum/audit-action.enum';
import { AuditActorTypeEnum } from '@/_db/drizzle/enum/audit-actor-type.enum';
import { TUserStatus } from '@/_db/drizzle/enum';
import {
  TUser,
  TUserCredential,
  TUserProfile,
} from '@/_db/drizzle/schema/identity';
import { hashPassword } from '@/libs/crypto/password';
import { CustomException } from '@/libs/exceptions/custom.exception';
import { MailService } from '@/libs/mail/mail.service';
import { ErrorCode } from '@/libs/response/error.schema';
import { EMAIL_VERIFICATION_EXPIRY_HOURS } from '@/libs/verification/email-verification.constants';
import {
  generateEmailVerificationToken,
  hashEmailVerificationToken,
} from '@/libs/verification/email-verification-token';
import { AuditService } from '@/modules/audit/audit.service';
import { EmailVerificationRepository } from '@/modules/identity/email-verification.repository';
import { IdentityRepository } from '@/modules/identity/identity.repository';
import { RegisterUserInput } from './dto/register-user.dto';
import { VerifyEmailInput } from './dto/verify-email.dto';

export type PublicUser = {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  status: TUserStatus;
};

@Injectable()
export class UserAuthService {
  constructor(
    private readonly identityRepository: IdentityRepository,
    private readonly emailVerificationRepository: EmailVerificationRepository,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly drizzleService: DrizzleService,
    private readonly i18n: I18nService,
  ) {}

  async register(
    payload: RegisterUserInput,
    lang: string = 'en',
    ip?: string | null,
  ): Promise<PublicUser> {
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
