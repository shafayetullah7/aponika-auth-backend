import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '@/modules/audit/audit.module';
import { IdentityModule } from '@/modules/identity/identity.module';
import { MailModule } from '@/libs/mail/mail.module';
import { OtpService } from '@/libs/otp/otp.service';
import { PasswordResetAttemptRepository } from './password-reset-attempt.repository';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetRateLimiterService } from './password-reset-rate-limiter.service';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [IdentityModule, AuditModule, MailModule, JwtModule.register({})],
  controllers: [PasswordResetController],
  providers: [
    PasswordResetService,
    PasswordResetAttemptRepository,
    PasswordResetRateLimiterService,
    OtpService,
  ],
})
export class PasswordResetModule {}
