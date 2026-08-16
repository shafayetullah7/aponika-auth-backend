import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { auditActorTypeEnum } from './audit-actor-type.enum.schema';

export const auditEventsTable = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorType: auditActorTypeEnum('actor_type').notNull(),
    actorId: uuid('actor_id'),
    action: varchar('action', { length: 128 }).notNull(),
    resourceType: varchar('resource_type', { length: 64 }),
    resourceId: uuid('resource_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ip: varchar('ip', { length: 45 }),
    userAgent: varchar('user_agent', { length: 512 }),
    createdAt: timestamp('created_at', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_audit_events_created_at').on(table.createdAt),
    index('idx_audit_events_action').on(table.action),
    index('idx_audit_events_actor').on(table.actorType, table.actorId),
    index('idx_audit_events_resource').on(table.resourceType, table.resourceId),
  ],
);

export type TAuditEvent = typeof auditEventsTable.$inferSelect;
export type TNewAuditEvent = typeof auditEventsTable.$inferInsert;
