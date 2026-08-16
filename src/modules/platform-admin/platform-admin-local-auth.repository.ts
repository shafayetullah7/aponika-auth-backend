import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import {
  platformAdminLocalAuthTable,
  TNewPlatformAdminLocalAuth,
  TPlatformAdminLocalAuth,
} from '@/_db/drizzle/schema/platform-admin/platform-admin-local-auth.schema';
import { DrizzleTx } from '@/_db/drizzle/types';

@Injectable()
export class PlatformAdminLocalAuthRepository {
  constructor(private readonly drizzleService: DrizzleService) {}

  async insert(
    data: TNewPlatformAdminLocalAuth,
    tx?: DrizzleTx,
  ): Promise<TPlatformAdminLocalAuth> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .insert(platformAdminLocalAuthTable)
      .values(data)
      .returning();

    return row;
  }

  async findByAdminId(
    adminId: string,
    tx?: DrizzleTx,
  ): Promise<TPlatformAdminLocalAuth | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(platformAdminLocalAuthTable)
      .where(eq(platformAdminLocalAuthTable.adminId, adminId))
      .limit(1);

    return row ?? null;
  }

  async update(
    adminId: string,
    data: Partial<TNewPlatformAdminLocalAuth>,
    tx?: DrizzleTx,
  ): Promise<TPlatformAdminLocalAuth | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .update(platformAdminLocalAuthTable)
      .set(data)
      .where(eq(platformAdminLocalAuthTable.adminId, adminId))
      .returning();

    return row ?? null;
  }
}
