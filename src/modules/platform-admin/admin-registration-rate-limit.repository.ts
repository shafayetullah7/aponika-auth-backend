import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import {
  ADMIN_REGISTRATION_RATE_LIMIT_GLOBAL_ID,
  adminRegistrationRateLimitTable,
  TAdminRegistrationRateLimit,
  TNewAdminRegistrationRateLimit,
} from '@/_db/drizzle/schema/platform-admin/admin-registration-rate-limit.schema';
import { DrizzleTx } from '@/_db/drizzle/types';

@Injectable()
export class AdminRegistrationRateLimitRepository {
  constructor(private readonly drizzleService: DrizzleService) {}

  async findGlobal(tx?: DrizzleTx): Promise<TAdminRegistrationRateLimit | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(adminRegistrationRateLimitTable)
      .where(
        eq(
          adminRegistrationRateLimitTable.id,
          ADMIN_REGISTRATION_RATE_LIMIT_GLOBAL_ID,
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async upsertGlobal(
    data: Pick<TNewAdminRegistrationRateLimit, 'lastOtpSentAt'>,
    tx?: DrizzleTx,
  ): Promise<TAdminRegistrationRateLimit> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .insert(adminRegistrationRateLimitTable)
      .values({
        id: ADMIN_REGISTRATION_RATE_LIMIT_GLOBAL_ID,
        lastOtpSentAt: data.lastOtpSentAt,
      })
      .onConflictDoUpdate({
        target: adminRegistrationRateLimitTable.id,
        set: {
          lastOtpSentAt: data.lastOtpSentAt,
        },
      })
      .returning();

    return row;
  }
}
