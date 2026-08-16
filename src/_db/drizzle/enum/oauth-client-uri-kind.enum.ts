export const OAuthClientUriKindEnum = {
  REDIRECT: 'redirect',
  POST_LOGOUT: 'post_logout',
  ALLOWED_ORIGIN: 'allowed_origin',
} as const;

export type TOAuthClientUriKind =
  (typeof OAuthClientUriKindEnum)[keyof typeof OAuthClientUriKindEnum];
