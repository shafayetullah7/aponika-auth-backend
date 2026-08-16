import {
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { userStatusEnum } from './user-status.enum.schema';

export const usersTable = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    status: userStatusEnum('status')
      .notNull()
      .default('ACTIVE'),
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
    index('idx_users_email').on(table.email),
    index('idx_users_status').on(table.status),
  ],
);

export type TUser = typeof usersTable.$inferSelect;
export type TNewUser = typeof usersTable.$inferInsert;
