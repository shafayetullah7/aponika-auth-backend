import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '@/modules/audit/audit.module';
import { MailModule } from '@/libs/mail/mail.module';
import { OtpService } from '@/libs/otp/otp.service';
import { SessionModule } from '@/modules/session/session.module';
import { OAuthModule } from '@/modules/oauth/oauth.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminClientsController } from './admin-clients.controller';
import { AdminLoginRateLimiterService } from './admin-login-rate-limiter.service';
import { AdminRegistrationAttemptRepository } from './admin-registration-attempt.repository';
import { AdminRegistrationRateLimitRepository } from './admin-registration-rate-limit.repository';
import { AdminRegistrationRateLimiterService } from './admin-registration-rate-limiter.service';
import { AdminRegistrationService } from './admin-registration.service';
import { PlatformAdminAuthService } from './platform-admin-auth.service';
import { PlatformAdminLocalAuthRepository } from './platform-admin-local-auth.repository';
import { PlatformAdminRepository } from './platform-admin.repository';

@Module({
  imports: [AuditModule, MailModule, SessionModule, OAuthModule, JwtModule.register({})],
  controllers: [AdminAuthController, AdminClientsController],
  providers: [
    PlatformAdminRepository,
    PlatformAdminLocalAuthRepository,
    AdminRegistrationAttemptRepository,
    AdminRegistrationRateLimitRepository,
    AdminRegistrationRateLimiterService,
    AdminRegistrationService,
    PlatformAdminAuthService,
    AdminLoginRateLimiterService,
    OtpService,
  ],
  exports: [
    PlatformAdminRepository,
    PlatformAdminLocalAuthRepository,
    AdminRegistrationAttemptRepository,
    AdminRegistrationRateLimitRepository,
    AdminRegistrationService,
    PlatformAdminAuthService,
  ],
})
export class PlatformAdminModule {}
