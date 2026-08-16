import {
  boolean,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { usersTable } from './user.schema';

export const userCredentialsTable = pgTable('user_credentials', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
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

export type TUserCredential = typeof userCredentialsTable.$inferSelect;
export type TNewUserCredential = typeof userCredentialsTable.$inferInsert;
