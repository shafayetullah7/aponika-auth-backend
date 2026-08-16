export const UserStatusEnum = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export type TUserStatus = (typeof UserStatusEnum)[keyof typeof UserStatusEnum];
