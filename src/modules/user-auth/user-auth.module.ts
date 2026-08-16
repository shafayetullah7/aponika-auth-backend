import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { IdentityModule } from '@/modules/identity/identity.module';
import { MailModule } from '@/libs/mail/mail.module';
import { UserAuthController } from './user-auth.controller';
import { UserAuthService } from './user-auth.service';

@Module({
  imports: [IdentityModule, AuditModule, MailModule],
  controllers: [UserAuthController],
  providers: [UserAuthService],
  exports: [UserAuthService],
})
export class UserAuthModule {}
