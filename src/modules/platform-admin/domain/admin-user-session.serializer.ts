import { TUserSession } from '@/_db/drizzle/schema/session/user-session.schema';
import { isUserSessionActive } from '@/modules/session/user-session.repository';

export type AdminUserSessionStatus = 'active' | 'revoked' | 'expired';

export type SerializedAdminUserSession = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  ip: string | null;
  deviceInfo: Record<string, unknown>;
  status: AdminUserSessionStatus;
};

export function resolveAdminUserSessionStatus(
  session: TUserSession,
): AdminUserSessionStatus {
  if (session.revokedAt) {
    return 'revoked';
  }

  if (!isUserSessionActive(session)) {
    return 'expired';
  }

  return 'active';
}

export function serializeAdminUserSession(
  session: TUserSession,
): SerializedAdminUserSession {
  return {
    id: session.id,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
    ip: session.ip,
    deviceInfo: session.deviceInfo,
    status: resolveAdminUserSessionStatus(session),
  };
}
