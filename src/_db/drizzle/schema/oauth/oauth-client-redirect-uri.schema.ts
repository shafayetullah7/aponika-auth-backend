import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { oauthClientsTable } from './oauth-client.schema';
import { oauthClientUriKindEnum } from './oauth-client-uri-kind.enum.schema';

export const oauthClientRedirectUrisTable = pgTable(
  'oauth_client_redirect_uris',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oauthClientId: uuid('oauth_client_id')
      .notNull()
      .references(() => oauthClientsTable.id, { onDelete: 'cascade' }),
    uri: text('uri').notNull(),
    kind: oauthClientUriKindEnum('kind').notNull(),
    createdAt: timestamp('created_at', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_oauth_client_redirect_uris_client_id').on(table.oauthClientId),
    uniqueIndex('uq_oauth_client_redirect_uris_client_kind_uri').on(
      table.oauthClientId,
      table.kind,
      table.uri,
    ),
  ],
);

export type TOAuthClientRedirectUri =
  typeof oauthClientRedirectUrisTable.$inferSelect;
export type TNewOAuthClientRedirectUri =
  typeof oauthClientRedirectUrisTable.$inferInsert;
