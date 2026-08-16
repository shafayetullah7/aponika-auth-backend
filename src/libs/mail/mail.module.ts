import { Module } from '@nestjs/common';
import { ConsoleMailProvider } from './console-mail.provider';
import { MailService } from './mail.service';

@Module({
  providers: [ConsoleMailProvider, MailService],
  exports: [MailService],
})
export class MailModule {}
