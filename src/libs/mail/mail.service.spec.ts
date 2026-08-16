import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppEnvService } from '@/libs/config/app-env.service';
import { ConsoleMailProvider } from './console-mail.provider';
import { SmtpMailProvider } from './smtp-mail.provider';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let logSpy: jest.SpyInstance;
  let smtpSend: jest.SpyInstance;

  const appEnv = {
    MAIL_PROVIDER: 'console',
    AUTH_FRONTEND_URL: 'http://localhost:3011',
  } as Pick<AppEnvService, 'MAIL_PROVIDER' | 'AUTH_FRONTEND_URL'>;

  beforeEach(async () => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    smtpSend = jest
      .spyOn(SmtpMailProvider.prototype, 'send')
      .mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        ConsoleMailProvider,
        SmtpMailProvider,
        {
          provide: AppEnvService,
          useValue: appEnv,
        },
      ],
    }).compile();

    service = module.get(MailService);
  });

  afterEach(() => {
    logSpy.mockRestore();
    smtpSend.mockRestore();
  });

  it('buildEmailVerificationUrl encodes the token', () => {
    expect(service.buildEmailVerificationUrl('abc+def/token')).toBe(
      'http://localhost:3011/verify-email?token=abc%2Bdef%2Ftoken',
    );
  });

  it('logs email verification link in console mode', async () => {
    await service.sendEmailVerification({
      to: 'user@example.com',
      token: 'verify-token-123',
      displayName: 'Test User',
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('to=user@example.com'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'http://localhost:3011/verify-email?token=verify-token-123',
      ),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('token=verify-token-123'));
  });

  it('logs admin registration OTP in console mode', async () => {
    await service.sendAdminRegistrationOtp({
      to: 'gatekeeper@example.com',
      otp: '123456',
      registrantEmail: 'admin@example.com',
      registrantUserName: 'jane_admin',
      registrantName: 'Jane Doe',
    });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('OTP: 123456'));
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('gatekeeper@example.com'),
    );
    expect(smtpSend).not.toHaveBeenCalled();
  });

  it('uses smtp provider when MAIL_PROVIDER is smtp', async () => {
    (appEnv as { MAIL_PROVIDER: string }).MAIL_PROVIDER = 'smtp';

    await service.sendAdminRegistrationOtp({
      to: 'gatekeeper@example.com',
      otp: '654321',
      registrantEmail: 'admin@example.com',
      registrantUserName: 'jane_admin',
      registrantName: 'Jane Doe',
    });

    expect(smtpSend).toHaveBeenCalledWith({
      to: 'gatekeeper@example.com',
      subject: 'Admin registration OTP — Aponika Auth',
      text: expect.stringContaining('OTP: 654321'),
    });
  });

  it('uses smtp provider when MAIL_PROVIDER is gmail', async () => {
    (appEnv as { MAIL_PROVIDER: string }).MAIL_PROVIDER = 'gmail';

    await service.sendAdminRegistrationOtp({
      to: 'gatekeeper@example.com',
      otp: '111222',
      registrantEmail: 'admin@example.com',
      registrantUserName: 'jane_admin',
      registrantName: 'Jane Doe',
    });

    expect(smtpSend).toHaveBeenCalledWith({
      to: 'gatekeeper@example.com',
      subject: 'Admin registration OTP — Aponika Auth',
      text: expect.stringContaining('OTP: 111222'),
    });
  });
});
