import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import {
  passwordResetAttemptsTable,
  TPasswordResetAttempt,
} from '@/_db/drizzle/schema/identity/password-reset-attempt.schema';
import { DrizzleTx } from '@/_db/drizzle/types';

export type UpsertPasswordResetAttemptInput = {
  email: string;
  otpHash: string;
  expiresAt: Date;
};

@Injectable()
export class PasswordResetAttemptRepository {
  constructor(private readonly drizzleService: DrizzleService) {}

  async findByEmail(
    email: string,
    tx?: DrizzleTx,
  ): Promise<TPasswordResetAttempt | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(passwordResetAttemptsTable)
      .where(eq(passwordResetAttemptsTable.email, email))
      .limit(1);

    return row ?? null;
  }

  async upsertAttempt(
    data: UpsertPasswordResetAttemptInput,
    tx?: DrizzleTx,
  ): Promise<TPasswordResetAttempt> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .insert(passwordResetAttemptsTable)
      .values({
        email: data.email,
        otpHash: data.otpHash,
        expiresAt: data.expiresAt,
        consumedAt: null,
      })
      .onConflictDoUpdate({
        target: passwordResetAttemptsTable.email,
        set: {
          otpHash: data.otpHash,
          expiresAt: data.expiresAt,
          consumedAt: null,
        },
      })
      .returning();

    return row;
  }

  async markConsumed(email: string, tx?: DrizzleTx): Promise<void> {
    const executor = this.drizzleService.getExecutor(tx);
    await executor
      .update(passwordResetAttemptsTable)
      .set({ consumedAt: new Date() })
      .where(eq(passwordResetAttemptsTable.email, email));
  }

  async deleteByEmail(email: string, tx?: DrizzleTx): Promise<void> {
    const executor = this.drizzleService.getExecutor(tx);
    await executor
      .delete(passwordResetAttemptsTable)
      .where(eq(passwordResetAttemptsTable.email, email));
  }
}
