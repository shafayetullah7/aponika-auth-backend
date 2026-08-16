import { pgEnum } from 'drizzle-orm/pg-core';
import { PlatformAdminRoleEnum } from '../../enum';

export const platformAdminRoleEnum = pgEnum('platform_admin_role_enum', [
  PlatformAdminRoleEnum.PLATFORM_ADMIN,
  PlatformAdminRoleEnum.SUPPORT,
]);
