import { HttpStatus, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import {
  TUser,
  TUserCredential,
  TUserProfile,
} from '@/_db/drizzle/schema/identity';
import { hashPassword, verifyPassword } from '@/libs/crypto/password';
import { CustomException } from '@/libs/exceptions/custom.exception';
import { ErrorCode } from '@/libs/response/error.schema';
import { AuthenticatedUser } from '@/libs/types/authenticated-user.type';
import { IdentityRepository } from '@/modules/identity/identity.repository';
import { PublicUser } from '@/modules/user-auth/user-auth.service';
import { ChangePasswordInput } from './dto/change-password.dto';
import { UpdateProfileInput } from './dto/update-profile.dto';

@Injectable()
export class AccountService {
  constructor(
    private readonly identityRepository: IdentityRepository,
    private readonly i18n: I18nService,
  ) {}

  async updateProfile(
    auth: AuthenticatedUser,
    payload: UpdateProfileInput,
    lang: string = 'en',
  ): Promise<PublicUser> {
    const profile = await this.identityRepository.upsertProfileDisplayName(
      auth.user.id,
      payload.name,
    );

    return this.toPublicUser(auth.user, auth.credential, profile);
  }

  async changePassword(
    auth: AuthenticatedUser,
    payload: ChangePasswordInput,
    lang: string = 'en',
  ): Promise<void> {
    const passwordMatches = await verifyPassword(
      payload.currentPassword,
      auth.credential.passwordHash,
    );

    if (!passwordMatches) {
      throw new CustomException({
        message: this.i18n.t('message.error.invalidCredentials', { lang }),
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: ErrorCode.INVALID_CREDENTIALS,
      });
    }

    const passwordHash = await hashPassword(payload.newPassword);
    await this.identityRepository.updatePasswordHash(auth.user.id, passwordHash);
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
