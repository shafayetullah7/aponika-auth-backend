import { Injectable, Logger } from '@nestjs/common';
import { MailMessage, MailProvider } from './mail.types';

@Injectable()
export class ConsoleMailProvider implements MailProvider {
  private readonly logger = new Logger(ConsoleMailProvider.name);

  async send(message: MailMessage): Promise<void> {
    this.logger.log(
      [
        '[MAIL:console]',
        `to=${message.to}`,
        `subject=${message.subject}`,
        message.text,
      ].join(' | '),
    );
  }
}
