import {
  index,
  inet,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { usersTable } from '../identity/user.schema';

export const userSessionsTable = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    deviceInfo: jsonb('device_info')
      .$type<Record<string, unknown>>()
      .notNull(),
    ip: inet('ip'),
    refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull(),
    revokedAt: timestamp('revoked_at', {
      mode: 'date',
      withTimezone: true,
    }),
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
    updatedAt: timestamp('updated_at', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_user_sessions_user_id').on(table.userId),
    index('idx_user_sessions_expires_at').on(table.expiresAt),
    index('idx_user_sessions_revoked_at').on(table.revokedAt),
  ],
);

export type TUserSession = typeof userSessionsTable.$inferSelect;
export type TNewUserSession = typeof userSessionsTable.$inferInsert;
