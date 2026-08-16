import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import {
  adminRegistrationAttemptsTable,
  TAdminRegistrationAttempt,
  TNewAdminRegistrationAttempt,
} from '@/_db/drizzle/schema/platform-admin/admin-registration-attempt.schema';
import { DrizzleTx } from '@/_db/drizzle/types';

@Injectable()
export class AdminRegistrationAttemptRepository {
  constructor(private readonly drizzleService: DrizzleService) {}

  async insert(
    data: TNewAdminRegistrationAttempt,
    tx?: DrizzleTx,
  ): Promise<TAdminRegistrationAttempt> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .insert(adminRegistrationAttemptsTable)
      .values(data)
      .returning();

    return row;
  }

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

  async findByUserName(
    userName: string,
    tx?: DrizzleTx,
  ): Promise<TAdminRegistrationAttempt | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(adminRegistrationAttemptsTable)
      .where(eq(adminRegistrationAttemptsTable.userName, userName))
      .limit(1);

    return row ?? null;
  }

  async deleteById(id: string, tx?: DrizzleTx): Promise<void> {
    const executor = this.drizzleService.getExecutor(tx);
    await executor
      .delete(adminRegistrationAttemptsTable)
      .where(eq(adminRegistrationAttemptsTable.id, id));
  }
}
