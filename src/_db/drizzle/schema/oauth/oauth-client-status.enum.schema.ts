import { pgEnum } from 'drizzle-orm/pg-core';
import { OAuthClientStatusEnum } from '../../enum';

export const oauthClientStatusEnum = pgEnum('oauth_client_status_enum', [
  OAuthClientStatusEnum.ACTIVE,
  OAuthClientStatusEnum.DISABLED,
]);
