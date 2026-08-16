import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/** In-flight password reset OTP attempts keyed by email. */
export const passwordResetAttemptsTable = pgTable('password_reset_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  otpHash: varchar('otp_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),
  consumedAt: timestamp('consumed_at', {
    mode: 'date',
    withTimezone: true,
  }),
  createdAt: timestamp('created_at', {
    mode: 'date',
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export type TPasswordResetAttempt =
  typeof passwordResetAttemptsTable.$inferSelect;
export type TNewPasswordResetAttempt =
  typeof passwordResetAttemptsTable.$inferInsert;
