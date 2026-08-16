import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/** In-flight platform admin registrations awaiting gatekeeper OTP verification. */
export const adminRegistrationAttemptsTable = pgTable(
  'admin_registration_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    userName: varchar('user_name', { length: 50 }).notNull().unique(),
    firstName: varchar('first_name', { length: 50 }).notNull(),
    lastName: varchar('last_name', { length: 50 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    otpHash: varchar('otp_hash', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
);

export type TAdminRegistrationAttempt =
  typeof adminRegistrationAttemptsTable.$inferSelect;
export type TNewAdminRegistrationAttempt =
  typeof adminRegistrationAttemptsTable.$inferInsert;
