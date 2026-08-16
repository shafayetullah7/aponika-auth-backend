import { TUserSession } from '@/_db/drizzle/schema/session/user-session.schema';
import { TUser } from '@/_db/drizzle/schema/identity/user.schema';
import { TUserCredential } from '@/_db/drizzle/schema/identity/user-credential.schema';
import { TUserProfile } from '@/_db/drizzle/schema/identity/user-profile.schema';

export type AuthenticatedUser = {
  user: TUser;
  credential: TUserCredential;
  profile: TUserProfile | null;
  session: TUserSession;
};
