import { pgEnum } from 'drizzle-orm/pg-core';
import { UserStatusEnum } from '../../enum';

export const userStatusEnum = pgEnum('user_status_enum', [
  UserStatusEnum.ACTIVE,
  UserStatusEnum.SUSPENDED,
]);
