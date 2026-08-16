import { Injectable } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import {
  adminRegistrationAttemptsTable,
  TAdminRegistrationAttempt,
} from '@/_db/drizzle/schema/platform-admin/admin-registration-attempt.schema';
import { DrizzleTx } from '@/_db/drizzle/types';

export type UpsertAdminRegistrationAttemptInput = {
  email: string;
  userName: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  otpHash: string;
  expiresAt: Date;
};

@Injectable()
export class AdminRegistrationAttemptRepository {
  constructor(private readonly drizzleService: DrizzleService) {}

  async findByEmail(
    email: string,
    tx?: DrizzleTx,
  ): Promise<TAdminRegistrationAttempt | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(adminRegistrationAttemptsTable)
      .where(eq(adminRegistrationAttemptsTable.email, email))
      .limit(1);

    return row ?? null;
  }

  async findByUserNameExcludingEmail(
    userName: string,
    email: string,
    tx?: DrizzleTx,
  ): Promise<TAdminRegistrationAttempt | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(adminRegistrationAttemptsTable)
      .where(
        and(
          eq(adminRegistrationAttemptsTable.userName, userName),
          ne(adminRegistrationAttemptsTable.email, email),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async upsertPendingRegistration(
    data: UpsertAdminRegistrationAttemptInput,
    tx?: DrizzleTx,
  ): Promise<TAdminRegistrationAttempt> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .insert(adminRegistrationAttemptsTable)
      .values(data)
      .onConflictDoUpdate({
        target: adminRegistrationAttemptsTable.email,
        set: {
          userName: data.userName,
          firstName: data.firstName,
          lastName: data.lastName,
          passwordHash: data.passwordHash,
          otpHash: data.otpHash,
          expiresAt: data.expiresAt,
        },
      })
      .returning();

    return row;
  }

  async deleteByEmail(email: string, tx?: DrizzleTx): Promise<void> {
    const executor = this.drizzleService.getExecutor(tx);
    await executor
      .delete(adminRegistrationAttemptsTable)
      .where(eq(adminRegistrationAttemptsTable.email, email));
  }
}
