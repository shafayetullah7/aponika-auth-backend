import { TAdminSession } from '@/_db/drizzle/schema/session/admin-session.schema';
import { TPlatformAdmin } from '@/_db/drizzle/schema/platform-admin/platform-admin.schema';

export type AuthenticatedPlatformAdmin = {
  admin: TPlatformAdmin;
  session: TAdminSession;
};
