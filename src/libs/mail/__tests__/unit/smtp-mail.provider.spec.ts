import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { AppEnvService } from '@/libs/config/app-env.service';
import { SmtpMailProvider } from '../../smtp-mail.provider';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('SmtpMailProvider', () => {
  const sendMail = jest.fn();
  const appEnv = {
    MAIL_HOST: 'smtp.gmail.com',
    MAIL_PORT: 587,
    MAIL_SECURE: 'false',
    MAIL_USER: 'sender@example.com',
    MAIL_PASSWORD: 'app-password',
    MAIL_FROM_NAME: 'Aponika Auth',
    MAIL_FROM_EMAIL: 'sender@example.com',
  } as Pick<
    AppEnvService,
    | 'MAIL_HOST'
    | 'MAIL_PORT'
    | 'MAIL_SECURE'
    | 'MAIL_USER'
    | 'MAIL_PASSWORD'
    | 'MAIL_FROM_NAME'
    | 'MAIL_FROM_EMAIL'
  >;

  let provider: SmtpMailProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    sendMail.mockResolvedValue({ messageId: 'msg-123' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    provider = new SmtpMailProvider(appEnv as AppEnvService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends mail via nodemailer transport', async () => {
    await provider.send({
      to: 'gatekeeper@example.com',
      subject: 'Admin registration OTP',
      text: 'OTP=123456',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'sender@example.com',
        pass: 'app-password',
      },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: '"Aponika Auth" <sender@example.com>',
      to: 'gatekeeper@example.com',
      subject: 'Admin registration OTP',
      text: 'OTP=123456',
    });
  });

  it('rethrows send failures', async () => {
    sendMail.mockRejectedValue(new Error('SMTP down'));

    await expect(
      provider.send({
        to: 'gatekeeper@example.com',
        subject: 'Test',
        text: 'body',
      }),
    ).rejects.toThrow('SMTP down');
  });
});
