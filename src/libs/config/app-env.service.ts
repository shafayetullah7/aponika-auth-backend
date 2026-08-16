import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppEnv } from './env.schema';

@Injectable()
export class AppEnvService {
  constructor(private readonly configService: ConfigService<AppEnv, true>) {}

  get NODE_ENV() {
    return this.configService.get('NODE_ENV', { infer: true });
  }

  get PORT() {
    return this.configService.get('PORT', { infer: true });
  }

  get APP_EXTERNAL_PORT() {
    return this.configService.get('APP_EXTERNAL_PORT', { infer: true });
  }

  get APP_NAME() {
    return this.configService.get('APP_NAME', { infer: true });
  }

  get DB_HOST() {
    return this.configService.get('DB_HOST', { infer: true });
  }

  get DB_PORT() {
    return this.configService.get('DB_PORT', { infer: true });
  }

  get DB_USER() {
    return this.configService.get('DB_USER', { infer: true });
  }

  get DB_PASSWORD() {
    return this.configService.get('DB_PASSWORD', { infer: true });
  }

  get DB_NAME() {
    return this.configService.get('DB_NAME', { infer: true });
  }

  get DB_SSL() {
    return this.configService.get('DB_SSL', { infer: true });
  }

  get DB_EXTERNAL_PORT() {
    return this.configService.get('DB_EXTERNAL_PORT', { infer: true });
  }

  get CORS_ORIGINS() {
    return this.configService.get('CORS_ORIGINS', { infer: true });
  }

  get OIDC_ISSUER() {
    return this.configService.get('OIDC_ISSUER', { infer: true });
  }

  get OIDC_ACCESS_TOKEN_TTL() {
    return this.configService.get('OIDC_ACCESS_TOKEN_TTL', { infer: true });
  }

  get OIDC_REFRESH_TOKEN_TTL() {
    return this.configService.get('OIDC_REFRESH_TOKEN_TTL', { infer: true });
  }

  get OIDC_DEFAULT_RESOURCE() {
    return this.configService.get('OIDC_DEFAULT_RESOURCE', { infer: true });
  }

  get OIDC_JWKS_PRIVATE_KEY_PATH() {
    return this.configService.get('OIDC_JWKS_PRIVATE_KEY_PATH', { infer: true });
  }

  get COOKIE_DOMAIN() {
    return this.configService.get('COOKIE_DOMAIN', { infer: true });
  }

  get SESSION_MAX_AGE() {
    return this.configService.get('SESSION_MAX_AGE', { infer: true });
  }

  get JWT_ADMIN_ACCESS_SECRET() {
    return this.configService.get('JWT_ADMIN_ACCESS_SECRET', { infer: true });
  }

  get JWT_ADMIN_ACCESS_EXP() {
    return this.configService.get('JWT_ADMIN_ACCESS_EXP', { infer: true });
  }

  get JWT_ADMIN_REFRESH_SECRET() {
    return this.configService.get('JWT_ADMIN_REFRESH_SECRET', { infer: true });
  }

  get JWT_ADMIN_REFRESH_EXP() {
    return this.configService.get('JWT_ADMIN_REFRESH_EXP', { infer: true });
  }

  get JWT_USER_ACCESS_SECRET() {
    return this.configService.get('JWT_USER_ACCESS_SECRET', { infer: true });
  }

  get JWT_USER_ACCESS_EXP() {
    return this.configService.get('JWT_USER_ACCESS_EXP', { infer: true });
  }

  get JWT_USER_REFRESH_SECRET() {
    return this.configService.get('JWT_USER_REFRESH_SECRET', { infer: true });
  }

  get JWT_USER_REFRESH_EXP() {
    return this.configService.get('JWT_USER_REFRESH_EXP', { infer: true });
  }

  get ADMIN_REGISTRATION_OTP_EMAIL() {
    return this.configService.get('ADMIN_REGISTRATION_OTP_EMAIL', {
      infer: true,
    });
  }

  get MAIL_PROVIDER() {
    return this.configService.get('MAIL_PROVIDER', { infer: true });
  }

  get MAIL_HOST() {
    return this.configService.get('MAIL_HOST', { infer: true });
  }

  get MAIL_PORT() {
    return this.configService.get('MAIL_PORT', { infer: true });
  }

  get MAIL_SECURE() {
    return this.configService.get('MAIL_SECURE', { infer: true });
  }

  get MAIL_USER() {
    return this.configService.get('MAIL_USER', { infer: true });
  }

  get MAIL_PASSWORD() {
    return this.configService.get('MAIL_PASSWORD', { infer: true });
  }

  get MAIL_FROM_NAME() {
    return this.configService.get('MAIL_FROM_NAME', { infer: true });
  }

  get MAIL_FROM_EMAIL() {
    return this.configService.get('MAIL_FROM_EMAIL', { infer: true });
  }

  get AUTH_FRONTEND_URL() {
    return this.configService.get('AUTH_FRONTEND_URL', { infer: true });
  }

  get isProduction() {
    return this.NODE_ENV === 'production';
  }
}
