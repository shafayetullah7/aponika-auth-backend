import { pgEnum } from 'drizzle-orm/pg-core';
import { AuditActorTypeEnum } from '../../enum';

export const auditActorTypeEnum = pgEnum('audit_actor_type_enum', [
  AuditActorTypeEnum.PLATFORM_ADMIN,
  AuditActorTypeEnum.USER,
  AuditActorTypeEnum.SYSTEM,
]);
