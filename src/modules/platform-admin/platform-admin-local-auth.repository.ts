import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import {
  platformAdminLocalAuthTable,
  TNewPlatformAdminLocalAuth,
  TPlatformAdminLocalAuth,
} from '@/_db/drizzle/schema/platform-admin/platform-admin-local-auth.schema';
import {
  platformAdminsTable,
  TPlatformAdmin,
} from '@/_db/drizzle/schema/platform-admin/platform-admin.schema';
import { DrizzleTx } from '@/_db/drizzle/types';

export type PlatformAdminWithLocalAuth = {
  admin: TPlatformAdmin;
  localAuth: TPlatformAdminLocalAuth;
};

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

  async findByEmail(
    email: string,
    tx?: DrizzleTx,
  ): Promise<PlatformAdminWithLocalAuth | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select({
        admin: platformAdminsTable,
        localAuth: platformAdminLocalAuthTable,
      })
      .from(platformAdminsTable)
      .innerJoin(
        platformAdminLocalAuthTable,
        eq(platformAdminLocalAuthTable.adminId, platformAdminsTable.id),
      )
      .where(eq(platformAdminsTable.email, email))
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
