export interface AdminRegistrationOtpMailInput {
  to: string;
  otp: string;
  registrantEmail: string;
  registrantUserName: string;
  registrantName: string;
}

export interface EmailVerificationMailInput {
  to: string;
  token: string;
  displayName?: string | null;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}
