export const OAuthClientStatusEnum = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
} as const;

export type TOAuthClientStatus =
  (typeof OAuthClientStatusEnum)[keyof typeof OAuthClientStatusEnum];
