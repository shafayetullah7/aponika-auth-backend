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
}
