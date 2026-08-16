import { Injectable } from '@nestjs/common';
import { TAuditAction } from '@/_db/drizzle/enum/audit-action.enum';
import { TAuditActorType } from '@/_db/drizzle/enum/audit-actor-type.enum';
import { TAuditEvent } from '@/_db/drizzle/schema/audit/audit-event.schema';
import { DrizzleTx } from '@/_db/drizzle/types';
import { AuditRepository } from './audit.repository';

export interface RecordAuditEventInput {
  actorType: TAuditActorType;
  actorId?: string | null;
  action: TAuditAction | string;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async record(
    input: RecordAuditEventInput,
    tx?: DrizzleTx,
  ): Promise<TAuditEvent> {
    return this.auditRepository.insert(
      {
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        action: input.action,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        metadata: input.metadata ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
      tx,
    );
  }
}
