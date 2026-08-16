import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import {
  ADMIN_REGISTRATION_RATE_LIMIT_GLOBAL_ID,
  adminRegistrationRateLimitTable,
} from '@/_db/drizzle/schema/platform-admin/admin-registration-rate-limit.schema';
import { DrizzleTx } from '@/_db/drizzle/types';

@Injectable()
export class AdminRegistrationRateLimitRepository {
  constructor(private readonly drizzleService: DrizzleService) {}

  async getLastOtpSentAtForUpdate(tx: DrizzleTx): Promise<Date | null> {
    const [row] = await tx
      .select({
        lastOtpSentAt: adminRegistrationRateLimitTable.lastOtpSentAt,
      })
      .from(adminRegistrationRateLimitTable)
      .where(
        eq(
          adminRegistrationRateLimitTable.id,
          ADMIN_REGISTRATION_RATE_LIMIT_GLOBAL_ID,
        ),
      )
      .limit(1)
      .for('update');

    return row?.lastOtpSentAt ?? null;
  }

  async recordOtpSent(tx: DrizzleTx, sentAt: Date): Promise<void> {
    await tx
      .insert(adminRegistrationRateLimitTable)
      .values({
        id: ADMIN_REGISTRATION_RATE_LIMIT_GLOBAL_ID,
        lastOtpSentAt: sentAt,
      })
      .onConflictDoUpdate({
        target: adminRegistrationRateLimitTable.id,
        set: { lastOtpSentAt: sentAt },
      });
  }
}
