import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number(),
  APP_EXTERNAL_PORT: z.coerce.number(),
  APP_NAME: z.string().min(1),

  DB_HOST: z.string(),
  DB_PORT: z.coerce.number(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  DB_SSL: z.enum(['true', 'false']).default('false'),
  DB_EXTERNAL_PORT: z.coerce.number(),

  CORS_ORIGINS: z.string().min(1),
});

export type AppEnv = z.infer<typeof envSchema>;
