import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { AppEnvService } from '@/libs/config/app-env.service';
import { MailMessage, MailProvider } from './mail.types';

@Injectable()
export class SmtpMailProvider implements MailProvider {
  private readonly logger = new Logger(SmtpMailProvider.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor(private readonly appEnv: AppEnvService) {
    this.fromAddress = `"${this.appEnv.MAIL_FROM_NAME}" <${this.appEnv.MAIL_FROM_EMAIL}>`;

    this.transporter = nodemailer.createTransport({
      host: this.appEnv.MAIL_HOST,
      port: this.appEnv.MAIL_PORT,
      secure: this.appEnv.MAIL_SECURE === 'true',
      auth: {
        user: this.appEnv.MAIL_USER,
        pass: this.appEnv.MAIL_PASSWORD,
      },
    });
  }

  async send(message: MailMessage): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });

      this.logger.log(`Email sent to ${message.to}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${message.to}`, error);
      throw error;
    }
  }
}
