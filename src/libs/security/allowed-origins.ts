import { AppEnvService } from '@/libs/config/app-env.service';

export function getAllowedOrigins(appEnv: AppEnvService): string[] {
  return appEnv.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
