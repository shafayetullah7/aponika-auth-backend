import { z } from 'zod';

const jwtSecret = z.string().min(32, 'JWT secrets must be at least 32 characters');

const durationString = z
  .string()
  .regex(/^\d+[smhd]$/, 'Expected duration like 15m, 7d, 1h');

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

  /** OIDC issuer URL (discovery, iss claim). No trailing slash. */
  OIDC_ISSUER: z.string().url(),

  /** OIDC access token TTL in seconds (default 15 minutes). */
  OIDC_ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),

  /**
   * Default resource indicator / JWT `aud` for access tokens (Byte Forge API in dev).
   */
  OIDC_DEFAULT_RESOURCE: z
    .string()
    .url()
    .default('http://localhost:3005'),

  /**
   * Path to RS256 private key PEM for OIDC JWKS (F21+).
   * Optional in dev until keys are generated.
   */
  OIDC_JWKS_PRIVATE_KEY_PATH: z.string().optional().default(''),

  COOKIE_DOMAIN: z.string().min(1),
  SESSION_MAX_AGE: z.coerce.number().int().positive(),

  JWT_ADMIN_ACCESS_SECRET: jwtSecret,
  JWT_ADMIN_ACCESS_EXP: durationString.default('15m'),
  JWT_ADMIN_REFRESH_SECRET: jwtSecret,
  JWT_ADMIN_REFRESH_EXP: durationString.default('7d'),

  JWT_USER_ACCESS_SECRET: jwtSecret,
  JWT_USER_ACCESS_EXP: durationString.default('15m'),
  JWT_USER_REFRESH_SECRET: jwtSecret,
  JWT_USER_REFRESH_EXP: durationString.default('7d'),

  /** Gatekeeper inbox for admin registration OTP (F5). */
  ADMIN_REGISTRATION_OTP_EMAIL: z.string().email(),

  /** Mail delivery: console logs OTP in dev; smtp reserved for later. */
  MAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),

  /** Auth frontend base URL for verification links (no trailing slash). */
  AUTH_FRONTEND_URL: z.string().url().default('http://localhost:3011'),
});

export type AppEnv = z.infer<typeof envSchema>;
