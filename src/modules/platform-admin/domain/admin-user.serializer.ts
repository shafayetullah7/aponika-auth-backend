import { TUserWithCredentialAndProfile } from '@/modules/identity/identity.repository';

export type SerializedAdminUserSummary = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  status: string;
  createdAt: Date;
};

export type SerializedAdminUserDetail = SerializedAdminUserSummary & {
  updatedAt: Date;
  sessionCount: number;
  activeSessionCount: number;
  lastLoginAt: Date | null;
};

export function serializeAdminUserSummary(
  row: TUserWithCredentialAndProfile,
): SerializedAdminUserSummary {
  return {
    id: row.user.id,
    email: row.user.email,
    emailVerified: row.credential.emailVerified,
    displayName: row.profile?.displayName ?? null,
    status: row.user.status,
    createdAt: row.user.createdAt,
  };
}

export function serializeAdminUserDetail(
  row: TUserWithCredentialAndProfile,
  authSummary: {
    sessionCount: number;
    activeSessionCount: number;
    lastLoginAt: Date | null;
  },
): SerializedAdminUserDetail {
  return {
    ...serializeAdminUserSummary(row),
    updatedAt: row.user.updatedAt,
    sessionCount: authSummary.sessionCount,
    activeSessionCount: authSummary.activeSessionCount,
    lastLoginAt: authSummary.lastLoginAt,
  };
}
