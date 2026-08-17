import { Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import {
  TUserEmailVerification,
  userEmailVerificationsTable,
} from '@/_db/drizzle/schema/identity';
import { DrizzleTx } from '@/_db/drizzle/types';

export type CreateEmailVerificationInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

@Injectable()
export class EmailVerificationRepository {
  constructor(private readonly drizzleService: DrizzleService) {}

  async create(
    input: CreateEmailVerificationInput,
    tx?: DrizzleTx,
  ): Promise<TUserEmailVerification> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .insert(userEmailVerificationsTable)
      .values({
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      })
      .returning();

    return row;
  }

  async findActiveByTokenHash(
    tokenHash: string,
    tx?: DrizzleTx,
  ): Promise<TUserEmailVerification | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(userEmailVerificationsTable)
      .where(
        and(
          eq(userEmailVerificationsTable.tokenHash, tokenHash),
          isNull(userEmailVerificationsTable.consumedAt),
          gt(userEmailVerificationsTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async markConsumed(id: string, tx?: DrizzleTx): Promise<void> {
    const executor = this.drizzleService.getExecutor(tx);
    await executor
      .update(userEmailVerificationsTable)
      .set({ consumedAt: new Date() })
      .where(eq(userEmailVerificationsTable.id, id));
  }

  async consumeActiveForUser(userId: string, tx?: DrizzleTx): Promise<void> {
    const executor = this.drizzleService.getExecutor(tx);
    await executor
      .update(userEmailVerificationsTable)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(userEmailVerificationsTable.userId, userId),
          isNull(userEmailVerificationsTable.consumedAt),
        ),
      );
  }
}
