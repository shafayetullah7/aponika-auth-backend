import { pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

/** Singleton row for global admin registration OTP throttle (id = 'global'). */
export const adminRegistrationRateLimitTable = pgTable(
  'admin_registration_rate_limit',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    lastOtpSentAt: timestamp('last_otp_sent_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
  },
);

export const ADMIN_REGISTRATION_RATE_LIMIT_GLOBAL_ID = 'global' as const;

export type TAdminRegistrationRateLimit =
  typeof adminRegistrationRateLimitTable.$inferSelect;
export type TNewAdminRegistrationRateLimit =
  typeof adminRegistrationRateLimitTable.$inferInsert;
