import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { usersTable } from './user.schema';

export const userProfilesTable = pgTable('user_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 255 }),
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

export type TUserProfile = typeof userProfilesTable.$inferSelect;
export type TNewUserProfile = typeof userProfilesTable.$inferInsert;
