import { Injectable } from '@nestjs/common';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import {
  auditEventsTable,
  TAuditEvent,
  TNewAuditEvent,
} from '@/_db/drizzle/schema/audit/audit-event.schema';
import { DrizzleTx } from '@/_db/drizzle/types';

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
}
