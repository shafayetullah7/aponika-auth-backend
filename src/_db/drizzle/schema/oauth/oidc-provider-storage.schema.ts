import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const oidcProviderStorageTable = pgTable(
  'oidc_provider_storage',
  {
    storageKey: text('storage_key').primaryKey(),
    payload: jsonb('payload').notNull(),
    expiresAt: timestamp('expires_at', {
      mode: 'date',
      withTimezone: true,
    }),
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
  (table) => [index('idx_oidc_provider_storage_expires_at').on(table.expiresAt)],
);

export type TOidcProviderStorage = typeof oidcProviderStorageTable.$inferSelect;
export type TNewOidcProviderStorage =
  typeof oidcProviderStorageTable.$inferInsert;
