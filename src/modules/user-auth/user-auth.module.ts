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

@Module({
  imports: [
    IdentityModule,
    AuditModule,
    MailModule,
    SessionModule,
    JwtModule.register({}),
  ],
  controllers: [UserAuthController, AccountController],
  providers: [UserAuthService, UserLoginRateLimiterService, AccountService],
  exports: [UserAuthService],
})
export class UserAuthModule {}
