import { pgEnum } from 'drizzle-orm/pg-core';
import { OAuthClientTypeEnum } from '../../enum';

export const oauthClientTypeEnum = pgEnum('oauth_client_type_enum', [
  OAuthClientTypeEnum.PUBLIC,
  OAuthClientTypeEnum.CONFIDENTIAL,
]);
