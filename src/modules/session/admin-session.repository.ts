import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import {
  adminSessionsTable,
  TAdminSession,
  TNewAdminSession,
} from '@/_db/drizzle/schema/session/admin-session.schema';
import { DrizzleTx } from '@/_db/drizzle/types';

@Injectable()
export class AdminSessionRepository {
  constructor(private readonly drizzleService: DrizzleService) {}

  async insert(
    data: TNewAdminSession,
    tx?: DrizzleTx,
  ): Promise<TAdminSession> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .insert(adminSessionsTable)
      .values(data)
      .returning();

    return row;
  }

  async findById(id: string, tx?: DrizzleTx): Promise<TAdminSession | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(adminSessionsTable)
      .where(eq(adminSessionsTable.id, id))
      .limit(1);

    return row ?? null;
  }

  async findActiveByAdminId(
    adminId: string,
    tx?: DrizzleTx,
  ): Promise<TAdminSession[]> {
    const executor = this.drizzleService.getExecutor(tx);
    return executor
      .select()
      .from(adminSessionsTable)
      .where(
        and(
          eq(adminSessionsTable.adminId, adminId),
          isNull(adminSessionsTable.revokedAt),
        ),
      );
  }

  async revoke(id: string, tx?: DrizzleTx): Promise<TAdminSession | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .update(adminSessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(adminSessionsTable.id, id))
      .returning();

    return row ?? null;
  }

  async update(
    id: string,
    data: Partial<TNewAdminSession>,
    tx?: DrizzleTx,
  ): Promise<TAdminSession | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .update(adminSessionsTable)
      .set(data)
      .where(eq(adminSessionsTable.id, id))
      .returning();

    return row ?? null;
  }
}
