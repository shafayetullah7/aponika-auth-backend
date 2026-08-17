/**
 * Known audit action identifiers. Stored as varchar — extend as features ship.
 * Format: `{domain}.{entity}.{verb}` or `{domain}.{verb}`
 */
export const AuditActionEnum = {
  ADMIN_REGISTRATION_COMPLETED: 'admin.registration.completed',
  ADMIN_LOGIN_SUCCESS: 'admin.login.success',
  ADMIN_LOGIN_FAILURE: 'admin.login.failure',
  ADMIN_LOGOUT: 'admin.logout',

  CLIENT_CREATED: 'client.created',
  CLIENT_UPDATED: 'client.updated',
  CLIENT_DISABLED: 'client.disabled',
  CLIENT_ENABLED: 'client.enabled',

  USER_REGISTERED: 'user.registered',
  USER_VERIFICATION_RESENT: 'user.verification.resent',
  USER_LOGIN_SUCCESS: 'user.login.success',
  USER_LOGIN_FAILURE: 'user.login.failure',
  USER_LOGOUT: 'user.logout',
  USER_SUSPENDED: 'user.suspended',
  USER_ACTIVATED: 'user.activated',
  USER_SESSION_REVOKED: 'user.session.revoked',
  USER_PASSWORD_RESET_REQUESTED: 'user.password_reset.requested',
  USER_PASSWORD_RESET_COMPLETED: 'user.password_reset.completed',

  OIDC_TOKEN_ISSUED: 'oidc.token.issued',
} as const;

export type TAuditAction =
  (typeof AuditActionEnum)[keyof typeof AuditActionEnum];
