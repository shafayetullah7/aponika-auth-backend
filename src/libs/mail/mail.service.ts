import { Injectable } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';
import { ConsoleMailProvider } from './console-mail.provider';
import { SmtpMailProvider } from './smtp-mail.provider';
import {
  AdminRegistrationOtpMailInput,
  EmailVerificationMailInput,
  MailProvider,
  PasswordResetOtpMailInput,
} from './mail.types';

@Injectable()
export class MailService {
  constructor(
    private readonly appEnv: AppEnvService,
    private readonly consoleMailProvider: ConsoleMailProvider,
    private readonly smtpMailProvider: SmtpMailProvider,
  ) {}

  async sendAdminRegistrationOtp(
    input: AdminRegistrationOtpMailInput,
  ): Promise<void> {
    await this.getProvider().send({
      to: input.to,
      subject: 'Admin registration OTP — Aponika Auth',
      text: [
        'A new platform admin registration was requested.',
        '',
        `OTP: ${input.otp}`,
        '',
        'Registrant details:',
        `  Name: ${input.registrantName}`,
        `  Email: ${input.registrantEmail}`,
        `  Username: @${input.registrantUserName}`,
        '',
        'Enter this OTP in the admin registration form to approve the account.',
        'Do not share this code.',
      ].join('\n'),
    });
  }

  async sendEmailVerification(
    input: EmailVerificationMailInput,
  ): Promise<void> {
    const verifyUrl = this.buildEmailVerificationUrl(input.token);

    await this.getProvider().send({
      to: input.to,
      subject: 'Verify your email',
      text: [
        input.displayName ? `Hello ${input.displayName},` : 'Hello,',
        `Verify your email: ${verifyUrl}`,
        `token=${input.token}`,
      ].join(' '),
    });
  }

  async sendPasswordResetOtp(input: PasswordResetOtpMailInput): Promise<void> {
    await this.getProvider().send({
      to: input.to,
      subject: 'Password reset code — Aponika',
      text: [
        'You requested a password reset for your Aponika account.',
        '',
        `Your one-time code: ${input.otp}`,
        '',
        'Enter this code in the password reset form. It expires in a few minutes.',
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
    });
  }

  buildEmailVerificationUrl(token: string): string {
    const base = this.appEnv.AUTH_FRONTEND_URL.replace(/\/$/, '');
    return `${base}/verify-email?token=${encodeURIComponent(token)}`;
  }

  private getProvider(): MailProvider {
    switch (this.appEnv.MAIL_PROVIDER) {
      case 'console':
        return this.consoleMailProvider;
      case 'gmail':
      case 'smtp':
        return this.smtpMailProvider;
      default:
        throw new Error(`Unsupported MAIL_PROVIDER: ${this.appEnv.MAIL_PROVIDER}`);
    }
  }
}
