import { pgEnum } from 'drizzle-orm/pg-core';
import { PlatformAdminStatusEnum } from '../../enum';

export const platformAdminStatusEnum = pgEnum('platform_admin_status_enum', [
  PlatformAdminStatusEnum.ACTIVE,
  PlatformAdminStatusEnum.SUSPENDED,
]);
