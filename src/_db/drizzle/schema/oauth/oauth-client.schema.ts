import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { oauthClientStatusEnum } from './oauth-client-status.enum.schema';
import { oauthClientTypeEnum } from './oauth-client-type.enum.schema';

export const oauthClientsTable = pgTable(
  'oauth_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id', { length: 128 }).notNull().unique(),
    clientSecretHash: varchar('client_secret_hash', { length: 255 }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    clientType: oauthClientTypeEnum('client_type').notNull(),
    grantTypes: text('grant_types').array().notNull(),
    responseTypes: text('response_types').array().notNull(),
    scopes: text('scopes').array().notNull(),
    pkceRequired: boolean('pkce_required').notNull().default(true),
    status: oauthClientStatusEnum('status').notNull().default('active'),
    createdBy: uuid('created_by'),
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
    index('idx_oauth_clients_client_id').on(table.clientId),
    index('idx_oauth_clients_status').on(table.status),
  ],
);

export type TOAuthClient = typeof oauthClientsTable.$inferSelect;
export type TNewOAuthClient = typeof oauthClientsTable.$inferInsert;
