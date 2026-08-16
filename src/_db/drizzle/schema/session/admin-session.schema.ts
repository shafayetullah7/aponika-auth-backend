import {
  index,
  inet,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { platformAdminsTable } from '../platform-admin/platform-admin.schema';

export const adminSessionsTable = pgTable(
  'admin_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => platformAdminsTable.id, { onDelete: 'cascade' }),
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
    index('idx_admin_sessions_admin_id').on(table.adminId),
    index('idx_admin_sessions_expires_at').on(table.expiresAt),
    index('idx_admin_sessions_revoked_at').on(table.revokedAt),
  ],
);

export type TAdminSession = typeof adminSessionsTable.$inferSelect;
export type TNewAdminSession = typeof adminSessionsTable.$inferInsert;
