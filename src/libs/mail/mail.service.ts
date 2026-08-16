import { Injectable, Logger } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';

export interface AdminRegistrationOtpMailInput {
  to: string;
  otp: string;
  registrantEmail: string;
  registrantUserName: string;
  registrantName: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly appEnv: AppEnvService) {}

  async sendAdminRegistrationOtp(
    input: AdminRegistrationOtpMailInput,
  ): Promise<void> {
    if (this.appEnv.MAIL_PROVIDER === 'console') {
      this.logger.log(
        [
          '[MAIL:console] Admin registration OTP',
          `to=${input.to}`,
          `otp=${input.otp}`,
          `registrant=${input.registrantName} <${input.registrantEmail}> (@${input.registrantUserName})`,
        ].join(' | '),
      );
      return;
    }

    throw new Error(`Unsupported MAIL_PROVIDER: ${this.appEnv.MAIL_PROVIDER}`);
  }
}
