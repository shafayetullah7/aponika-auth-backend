import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import { UserStatusEnum, TUserStatus } from '@/_db/drizzle/enum';
import {
  TUser,
  TUserCredential,
  TUserProfile,
  userCredentialsTable,
  userProfilesTable,
  usersTable,
} from '@/_db/drizzle/schema/identity';
import { DrizzleTx } from '@/_db/drizzle/types';

export type TUserWithCredentialAndProfile = {
  user: TUser;
  credential: TUserCredential;
  profile: TUserProfile | null;
};

export type CreateUserWithCredentialInput = {
  email: string;
  passwordHash: string;
  displayName?: string | null;
  status?: TUserStatus;
  emailVerified?: boolean;
};

@Injectable()
export class IdentityRepository {
  constructor(private readonly drizzleService: DrizzleService) {}

  async findByEmail(
    email: string,
    tx?: DrizzleTx,
  ): Promise<TUser | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    return row ?? null;
  }

  async findById(
    id: string,
    tx?: DrizzleTx,
  ): Promise<TUser | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    return row ?? null;
  }

  async createUserWithCredential(
    input: CreateUserWithCredentialInput,
    tx?: DrizzleTx,
  ): Promise<TUserWithCredentialAndProfile> {
    if (tx) {
      return this.createUserWithCredentialInTx(input, tx);
    }

    return this.drizzleService.transaction((innerTx) =>
      this.createUserWithCredentialInTx(input, innerTx),
    );
  }

  private async createUserWithCredentialInTx(
    input: CreateUserWithCredentialInput,
    tx: DrizzleTx,
  ): Promise<TUserWithCredentialAndProfile> {
    const [user] = await tx
      .insert(usersTable)
      .values({
        email: input.email,
        status: input.status ?? UserStatusEnum.ACTIVE,
      })
      .returning();

    const [credential] = await tx
      .insert(userCredentialsTable)
      .values({
        userId: user.id,
        passwordHash: input.passwordHash,
        emailVerified: input.emailVerified ?? false,
      })
      .returning();

    let profile: TUserProfile | null = null;
    if (input.displayName !== undefined) {
      const [createdProfile] = await tx
        .insert(userProfilesTable)
        .values({
          userId: user.id,
          displayName: input.displayName,
        })
        .returning();
      profile = createdProfile;
    }

    return { user, credential, profile };
  }
}
