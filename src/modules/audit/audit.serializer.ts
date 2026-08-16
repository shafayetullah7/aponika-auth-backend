import { TAuditEvent } from '@/_db/drizzle/schema/audit/audit-event.schema';

export type SerializedAuditEvent = {
  id: string;
  actorType: TAuditEvent['actorType'];
  actorId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: Date;
};

export function serializeAuditEvent(event: TAuditEvent): SerializedAuditEvent {
  return {
    id: event.id,
    actorType: event.actorType,
    actorId: event.actorId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    metadata: event.metadata ?? null,
    ip: event.ip,
    createdAt: event.createdAt,
  };
}
