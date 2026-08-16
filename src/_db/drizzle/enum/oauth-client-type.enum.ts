export const OAuthClientTypeEnum = {
  PUBLIC: 'public',
  CONFIDENTIAL: 'confidential',
} as const;

export type TOAuthClientType =
  (typeof OAuthClientTypeEnum)[keyof typeof OAuthClientTypeEnum];
