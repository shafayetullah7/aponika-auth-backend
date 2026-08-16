import { Module } from '@nestjs/common';
import { AdminRegistrationAttemptRepository } from './admin-registration-attempt.repository';
import { AdminRegistrationRateLimitRepository } from './admin-registration-rate-limit.repository';
import { PlatformAdminLocalAuthRepository } from './platform-admin-local-auth.repository';
import { PlatformAdminRepository } from './platform-admin.repository';

@Module({
  providers: [
    PlatformAdminRepository,
    PlatformAdminLocalAuthRepository,
    AdminRegistrationAttemptRepository,
    AdminRegistrationRateLimitRepository,
  ],
  exports: [
    PlatformAdminRepository,
    PlatformAdminLocalAuthRepository,
    AdminRegistrationAttemptRepository,
    AdminRegistrationRateLimitRepository,
  ],
})
export class PlatformAdminModule {}
