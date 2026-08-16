export const PlatformAdminRoleEnum = {
  PLATFORM_ADMIN: 'platform_admin',
  SUPPORT: 'support',
} as const;

export type TPlatformAdminRole =
  (typeof PlatformAdminRoleEnum)[keyof typeof PlatformAdminRoleEnum];
