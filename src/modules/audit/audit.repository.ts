import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, lte, SQL } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import { TAuditAction } from '@/_db/drizzle/enum/audit-action.enum';
import {
  auditEventsTable,
  TAuditEvent,
  TNewAuditEvent,
} from '@/_db/drizzle/schema/audit/audit-event.schema';
import { DrizzleTx } from '@/_db/drizzle/types';

export type ListAuditEventsFilter = {
  limit: number;
  offset: number;
  action?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
};

function buildAuditEventConditions(
  filter: Omit<ListAuditEventsFilter, 'limit' | 'offset'>,
): SQL | undefined {
  const conditions: SQL[] = [];

  if (filter.action) {
    conditions.push(eq(auditEventsTable.action, filter.action));
  }

  if (filter.actorId) {
    conditions.push(eq(auditEventsTable.actorId, filter.actorId));
  }

  if (filter.from) {
    conditions.push(gte(auditEventsTable.createdAt, filter.from));
  }

  if (filter.to) {
    conditions.push(lte(auditEventsTable.createdAt, filter.to));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly drizzleService: DrizzleService) {}

  async insert(
    data: TNewAuditEvent,
    tx?: DrizzleTx,
  ): Promise<TAuditEvent> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .insert(auditEventsTable)
      .values(data)
      .returning();

    return row;
  }

  async listByResource(
    resourceType: string,
    resourceId: string,
    limit = 10,
  ): Promise<TAuditEvent[]> {
    return this.drizzleService.client
      .select()
      .from(auditEventsTable)
      .where(
        and(
          eq(auditEventsTable.resourceType, resourceType),
          eq(auditEventsTable.resourceId, resourceId),
        ),
      )
      .orderBy(desc(auditEventsTable.createdAt))
      .limit(limit);
  }

  async findLatestByActorAndAction(
    actorId: string,
    action: TAuditAction,
  ): Promise<TAuditEvent | null> {
    const [row] = await this.drizzleService.client
      .select()
      .from(auditEventsTable)
      .where(
        and(
          eq(auditEventsTable.actorId, actorId),
          eq(auditEventsTable.action, action),
        ),
      )
      .orderBy(desc(auditEventsTable.createdAt))
      .limit(1);

    return row ?? null;
  }

  async list(filter: ListAuditEventsFilter): Promise<TAuditEvent[]> {
    const where = buildAuditEventConditions(filter);

    const query = this.drizzleService.client
      .select()
      .from(auditEventsTable)
      .orderBy(desc(auditEventsTable.createdAt))
      .limit(filter.limit)
      .offset(filter.offset);

    if (where) {
      return query.where(where);
    }

    return query;
  }

  async count(
    filter: Omit<ListAuditEventsFilter, 'limit' | 'offset'>,
  ): Promise<number> {
    const where = buildAuditEventConditions(filter);

    const query = this.drizzleService.client
      .select({ value: count() })
      .from(auditEventsTable);

    const [result] = where ? await query.where(where) : await query;

    return Number(result?.value ?? 0);
  }
}
