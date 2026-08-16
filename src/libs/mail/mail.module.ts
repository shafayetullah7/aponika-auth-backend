import { Module } from '@nestjs/common';
import { ConsoleMailProvider } from './console-mail.provider';
import { SmtpMailProvider } from './smtp-mail.provider';
import { MailService } from './mail.service';

@Module({
  providers: [ConsoleMailProvider, SmtpMailProvider, MailService],
  exports: [MailService],
})
export class MailModule {}
