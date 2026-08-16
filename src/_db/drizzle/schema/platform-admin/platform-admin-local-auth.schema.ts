import {
  boolean,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { platformAdminsTable } from './platform-admin.schema';

export const platformAdminLocalAuthTable = pgTable('platform_admin_local_auth', {
  adminId: uuid('admin_id')
    .primaryKey()
    .references(() => platformAdminsTable.id, { onDelete: 'cascade' }),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  verified: boolean('verified').notNull().default(false),
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
});

export type TPlatformAdminLocalAuth =
  typeof platformAdminLocalAuthTable.$inferSelect;
export type TNewPlatformAdminLocalAuth =
  typeof platformAdminLocalAuthTable.$inferInsert;
