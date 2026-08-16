import { pgEnum } from 'drizzle-orm/pg-core';
import { OAuthClientUriKindEnum } from '../../enum';

export const oauthClientUriKindEnum = pgEnum('oauth_client_uri_kind_enum', [
  OAuthClientUriKindEnum.REDIRECT,
  OAuthClientUriKindEnum.POST_LOGOUT,
  OAuthClientUriKindEnum.ALLOWED_ORIGIN,
]);
