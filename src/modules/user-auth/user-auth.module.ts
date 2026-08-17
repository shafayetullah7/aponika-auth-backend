import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '@/modules/audit/audit.module';
import { IdentityModule } from '@/modules/identity/identity.module';
import { SessionModule } from '@/modules/session/session.module';
import { MailModule } from '@/libs/mail/mail.module';
import { AccountController } from '@/modules/account/account.controller';
import { AccountService } from '@/modules/account/account.service';
import { UserAuthController } from './user-auth.controller';
import { UserAuthService } from './user-auth.service';
import { UserLoginRateLimiterService } from './user-login-rate-limiter.service';
import { UserRegistrationRateLimiterService } from './user-registration-rate-limiter.service';
import { UserVerificationResendRateLimiterService } from './user-verification-resend-rate-limiter.service';

@Module({
  imports: [
    IdentityModule,
    AuditModule,
    MailModule,
    SessionModule,
    JwtModule.register({}),
  ],
  controllers: [UserAuthController, AccountController],
  providers: [
    UserAuthService,
    UserLoginRateLimiterService,
    UserRegistrationRateLimiterService,
    UserVerificationResendRateLimiterService,
    AccountService,
  ],
  exports: [UserAuthService],
})
export class UserAuthModule {}
