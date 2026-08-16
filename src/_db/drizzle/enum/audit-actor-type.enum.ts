export const AuditActorTypeEnum = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  USER: 'USER',
  SYSTEM: 'SYSTEM',
} as const;

export type TAuditActorType =
  (typeof AuditActorTypeEnum)[keyof typeof AuditActorTypeEnum];
