import {
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { usersTable } from './user.schema';

export const userEmailVerificationsTable = pgTable(
  'user_email_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
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
  },
  (table) => [
    index('idx_user_email_verifications_user_id').on(table.userId),
    index('idx_user_email_verifications_token_hash').on(table.tokenHash),
  ],
);

export type TUserEmailVerification =
  typeof userEmailVerificationsTable.$inferSelect;
export type TNewUserEmailVerification =
  typeof userEmailVerificationsTable.$inferInsert;
