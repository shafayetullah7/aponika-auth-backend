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

  async findByEmailWithCredentialAndProfile(
    email: string,
    tx?: DrizzleTx,
  ): Promise<TUserWithCredentialAndProfile | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select({
        user: usersTable,
        credential: userCredentialsTable,
        profile: userProfilesTable,
      })
      .from(usersTable)
      .innerJoin(
        userCredentialsTable,
        eq(usersTable.id, userCredentialsTable.userId),
      )
      .leftJoin(
        userProfilesTable,
        eq(usersTable.id, userProfilesTable.userId),
      )
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      user: row.user,
      credential: row.credential,
      profile: row.profile,
    };
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

  async findCredentialByUserId(
    userId: string,
    tx?: DrizzleTx,
  ): Promise<TUserCredential | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(userCredentialsTable)
      .where(eq(userCredentialsTable.userId, userId))
      .limit(1);

    return row ?? null;
  }

  async markEmailVerified(userId: string, tx?: DrizzleTx): Promise<void> {
    const executor = this.drizzleService.getExecutor(tx);
    await executor
      .update(userCredentialsTable)
      .set({ emailVerified: true })
      .where(eq(userCredentialsTable.userId, userId));
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
    tx?: DrizzleTx,
  ): Promise<void> {
    const executor = this.drizzleService.getExecutor(tx);
    await executor
      .update(userCredentialsTable)
      .set({ passwordHash })
      .where(eq(userCredentialsTable.userId, userId));
  }

  async upsertProfileDisplayName(
    userId: string,
    displayName: string,
    tx?: DrizzleTx,
  ): Promise<TUserProfile> {
    const executor = this.drizzleService.getExecutor(tx);
    const [existing] = await executor
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId))
      .limit(1);

    if (existing) {
      const [updated] = await executor
        .update(userProfilesTable)
        .set({ displayName })
        .where(eq(userProfilesTable.userId, userId))
        .returning();

      return updated;
    }

    const [created] = await executor
      .insert(userProfilesTable)
      .values({ userId, displayName })
      .returning();

    return created;
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
