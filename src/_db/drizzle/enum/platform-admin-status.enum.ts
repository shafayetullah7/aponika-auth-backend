export const PlatformAdminStatusEnum = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
} as const;

export type TPlatformAdminStatus =
  (typeof PlatformAdminStatusEnum)[keyof typeof PlatformAdminStatusEnum];
