import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import {
  TUser,
  TUserCredential,
  TUserProfile,
  userCredentialsTable,
  userProfilesTable,
  usersTable,
} from '@/_db/drizzle/schema/identity';
import {
  TUserSession,
  TNewUserSession,
  userSessionsTable,
} from '@/_db/drizzle/schema/session/user-session.schema';
import { DrizzleTx } from '@/_db/drizzle/types';

export type UserSessionWithUser = {
  session: TUserSession;
  user: TUser;
  credential: TUserCredential;
  profile: TUserProfile | null;
};

export function isUserSessionActive(session: TUserSession): boolean {
  return !session.revokedAt && session.expiresAt.getTime() > Date.now();
}

@Injectable()
export class UserSessionRepository {
  constructor(private readonly drizzleService: DrizzleService) {}

  async insert(data: TNewUserSession, tx?: DrizzleTx): Promise<TUserSession> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .insert(userSessionsTable)
      .values(data)
      .returning();

    return row;
  }

  async findById(id: string, tx?: DrizzleTx): Promise<TUserSession | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(userSessionsTable)
      .where(eq(userSessionsTable.id, id))
      .limit(1);

    return row ?? null;
  }

  async findByIdWithUser(
    id: string,
    tx?: DrizzleTx,
  ): Promise<UserSessionWithUser | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select({
        session: userSessionsTable,
        user: usersTable,
        credential: userCredentialsTable,
        profile: userProfilesTable,
      })
      .from(userSessionsTable)
      .innerJoin(usersTable, eq(userSessionsTable.userId, usersTable.id))
      .innerJoin(
        userCredentialsTable,
        eq(usersTable.id, userCredentialsTable.userId),
      )
      .leftJoin(
        userProfilesTable,
        eq(usersTable.id, userProfilesTable.userId),
      )
      .where(eq(userSessionsTable.id, id))
      .limit(1);

    return row ?? null;
  }

  async findByIdForUser(
    sessionId: string,
    userId: string,
    tx?: DrizzleTx,
  ): Promise<TUserSession | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(userSessionsTable)
      .where(
        and(
          eq(userSessionsTable.id, sessionId),
          eq(userSessionsTable.userId, userId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async listByUserId(
    userId: string,
    options: { limit: number; offset: number },
    tx?: DrizzleTx,
  ): Promise<TUserSession[]> {
    const executor = this.drizzleService.getExecutor(tx);
    return executor
      .select()
      .from(userSessionsTable)
      .where(eq(userSessionsTable.userId, userId))
      .orderBy(desc(userSessionsTable.createdAt))
      .limit(options.limit)
      .offset(options.offset);
  }

  async findActiveByUserId(
    userId: string,
    tx?: DrizzleTx,
  ): Promise<TUserSession[]> {
    const executor = this.drizzleService.getExecutor(tx);
    return executor
      .select()
      .from(userSessionsTable)
      .where(
        and(
          eq(userSessionsTable.userId, userId),
          isNull(userSessionsTable.revokedAt),
        ),
      );
  }

  async revoke(id: string, tx?: DrizzleTx): Promise<TUserSession | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .update(userSessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(userSessionsTable.id, id))
      .returning();

    return row ?? null;
  }

  async revokeAllActiveByUserId(
    userId: string,
    tx?: DrizzleTx,
  ): Promise<number> {
    const executor = this.drizzleService.getExecutor(tx);
    const rows = await executor
      .update(userSessionsTable)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(userSessionsTable.userId, userId),
          isNull(userSessionsTable.revokedAt),
        ),
      )
      .returning({ id: userSessionsTable.id });

    return rows.length;
  }

  async countByUserId(
    userId: string,
    tx?: DrizzleTx,
  ): Promise<{ total: number; active: number }> {
    const executor = this.drizzleService.getExecutor(tx);
    const now = new Date();

    const [totalResult] = await executor
      .select({ value: count() })
      .from(userSessionsTable)
      .where(eq(userSessionsTable.userId, userId));

    const [activeResult] = await executor
      .select({ value: count() })
      .from(userSessionsTable)
      .where(
        and(
          eq(userSessionsTable.userId, userId),
          isNull(userSessionsTable.revokedAt),
          gt(userSessionsTable.expiresAt, now),
        ),
      );

    return {
      total: Number(totalResult?.value ?? 0),
      active: Number(activeResult?.value ?? 0),
    };
  }

  async update(
    id: string,
    data: Partial<TNewUserSession>,
    tx?: DrizzleTx,
  ): Promise<TUserSession | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .update(userSessionsTable)
      .set(data)
      .where(eq(userSessionsTable.id, id))
      .returning();

    return row ?? null;
  }
}
