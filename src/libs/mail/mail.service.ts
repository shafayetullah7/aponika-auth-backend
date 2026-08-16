import { Injectable } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';
import { ConsoleMailProvider } from './console-mail.provider';
import {
  AdminRegistrationOtpMailInput,
  EmailVerificationMailInput,
  MailProvider,
} from './mail.types';

@Injectable()
export class MailService {
  constructor(
    private readonly appEnv: AppEnvService,
    private readonly consoleMailProvider: ConsoleMailProvider,
  ) {}

  async sendAdminRegistrationOtp(
    input: AdminRegistrationOtpMailInput,
  ): Promise<void> {
    await this.getProvider().send({
      to: input.to,
      subject: 'Admin registration OTP',
      text: [
        `OTP=${input.otp}`,
        `registrant=${input.registrantName} <${input.registrantEmail}> (@${input.registrantUserName})`,
      ].join(' | '),
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

  buildEmailVerificationUrl(token: string): string {
    const base = this.appEnv.AUTH_FRONTEND_URL.replace(/\/$/, '');
    return `${base}/verify-email?token=${encodeURIComponent(token)}`;
  }

  private getProvider(): MailProvider {
    if (this.appEnv.MAIL_PROVIDER === 'console') {
      return this.consoleMailProvider;
    }

    throw new Error(`Unsupported MAIL_PROVIDER: ${this.appEnv.MAIL_PROVIDER}`);
  }
}
