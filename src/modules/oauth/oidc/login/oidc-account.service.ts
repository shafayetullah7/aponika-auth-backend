import { Injectable } from '@nestjs/common';
import { IdentityRepository } from '@/modules/identity/identity.repository';

type OidcAccount = {
  accountId: string;
  claims: (
    use?: string,
    scope?: string,
    claims?: Record<string, unknown> | null,
    rejected?: string[],
  ) => Promise<Record<string, unknown>>;
};

@Injectable()
export class OidcAccountService {
  constructor(private readonly identityRepository: IdentityRepository) {}

  async findAccount(
    _ctx: unknown,
    id: string,
  ): Promise<OidcAccount | undefined> {
    const user = await this.identityRepository.findById(id);
    if (!user) {
      return undefined;
    }

    const credential = await this.identityRepository.findCredentialByUserId(
      id,
    );
    if (!credential) {
      return undefined;
    }

    return {
      accountId: id,
      claims: async () => ({
        sub: id,
        email: user.email,
        email_verified: credential.emailVerified,
      }),
    };
  }
}
