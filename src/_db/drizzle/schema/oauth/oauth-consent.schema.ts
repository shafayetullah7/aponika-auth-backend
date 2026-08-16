import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { usersTable } from '../identity/user.schema';
import { oauthClientsTable } from './oauth-client.schema';

export const oauthConsentsTable = pgTable(
  'oauth_consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    oauthClientId: uuid('oauth_client_id')
      .notNull()
      .references(() => oauthClientsTable.id, { onDelete: 'cascade' }),
    scopes: text('scopes').array().notNull(),
    remember: boolean('remember').notNull().default(false),
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
    uniqueIndex('uq_oauth_consents_user_client').on(
      table.userId,
      table.oauthClientId,
    ),
    index('idx_oauth_consents_user_id').on(table.userId),
    index('idx_oauth_consents_oauth_client_id').on(table.oauthClientId),
  ],
);

export type TOAuthConsent = typeof oauthConsentsTable.$inferSelect;
export type TNewOAuthConsent = typeof oauthConsentsTable.$inferInsert;
