import { Module } from '@nestjs/common';
import { EmailVerificationRepository } from './email-verification.repository';
import { IdentityRepository } from './identity.repository';

@Module({
  providers: [IdentityRepository, EmailVerificationRepository],
  exports: [IdentityRepository, EmailVerificationRepository],
})
export class IdentityModule {}
