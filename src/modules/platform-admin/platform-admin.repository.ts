import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import {
  platformAdminsTable,
  TNewPlatformAdmin,
  TPlatformAdmin,
} from '@/_db/drizzle/schema/platform-admin/platform-admin.schema';
import { DrizzleTx } from '@/_db/drizzle/types';

@Injectable()
export class PlatformAdminRepository {
  constructor(private readonly drizzleService: DrizzleService) {}

  async insert(
    data: TNewPlatformAdmin,
    tx?: DrizzleTx,
  ): Promise<TPlatformAdmin> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .insert(platformAdminsTable)
      .values(data)
      .returning();

    return row;
  }

  async findById(
    id: string,
    tx?: DrizzleTx,
  ): Promise<TPlatformAdmin | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(platformAdminsTable)
      .where(eq(platformAdminsTable.id, id))
      .limit(1);

    return row ?? null;
  }

  async findByEmail(
    email: string,
    tx?: DrizzleTx,
  ): Promise<TPlatformAdmin | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(platformAdminsTable)
      .where(eq(platformAdminsTable.email, email))
      .limit(1);

    return row ?? null;
  }

  async findByUserName(
    userName: string,
    tx?: DrizzleTx,
  ): Promise<TPlatformAdmin | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(platformAdminsTable)
      .where(eq(platformAdminsTable.userName, userName))
      .limit(1);

    return row ?? null;
  }

  async update(
    id: string,
    data: Partial<TNewPlatformAdmin>,
    tx?: DrizzleTx,
  ): Promise<TPlatformAdmin | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .update(platformAdminsTable)
      .set(data)
      .where(eq(platformAdminsTable.id, id))
      .returning();

    return row ?? null;
  }
}
