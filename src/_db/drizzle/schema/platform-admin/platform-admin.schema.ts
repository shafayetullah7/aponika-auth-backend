import {
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { platformAdminRoleEnum } from './platform-admin-role.enum.schema';
import { platformAdminStatusEnum } from './platform-admin-status.enum.schema';

export const platformAdminsTable = pgTable(
  'platform_admins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: varchar('first_name', { length: 50 }).notNull(),
    lastName: varchar('last_name', { length: 50 }).notNull(),
    userName: varchar('user_name', { length: 50 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    status: platformAdminStatusEnum('status')
      .notNull()
      .default('active'),
    role: platformAdminRoleEnum('role')
      .notNull()
      .default('platform_admin'),
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
    index('idx_platform_admins_email').on(table.email),
    index('idx_platform_admins_user_name').on(table.userName),
    index('idx_platform_admins_status').on(table.status),
  ],
);

export type TPlatformAdmin = typeof platformAdminsTable.$inferSelect;
export type TNewPlatformAdmin = typeof platformAdminsTable.$inferInsert;
