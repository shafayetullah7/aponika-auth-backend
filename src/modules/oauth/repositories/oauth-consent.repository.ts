import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import {
  oauthConsentsTable,
  oauthClientsTable,
  TOAuthConsent,
  TNewOAuthConsent,
} from '@/_db/drizzle/schema/oauth';
import { DrizzleTx } from '@/_db/drizzle/types';

@Injectable()
export class OAuthConsentRepository {
  constructor(private readonly drizzleService: DrizzleService) {}

  async findRemembered(
    userId: string,
    oauthClientId: string,
    tx?: DrizzleTx,
  ): Promise<TOAuthConsent | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(oauthConsentsTable)
      .where(
        and(
          eq(oauthConsentsTable.userId, userId),
          eq(oauthConsentsTable.oauthClientId, oauthClientId),
          eq(oauthConsentsTable.remember, true),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async listRememberedByUser(
    userId: string,
  ): Promise<
    Array<TOAuthConsent & { clientId: string; clientName: string }>
  > {
    const rows = await this.drizzleService.client
      .select({
        consent: oauthConsentsTable,
        clientId: oauthClientsTable.clientId,
        clientName: oauthClientsTable.name,
      })
      .from(oauthConsentsTable)
      .innerJoin(
        oauthClientsTable,
        eq(oauthConsentsTable.oauthClientId, oauthClientsTable.id),
      )
      .where(
        and(
          eq(oauthConsentsTable.userId, userId),
          eq(oauthConsentsTable.remember, true),
        ),
      );

    return rows.map((row) => ({
      ...row.consent,
      clientId: row.clientId,
      clientName: row.clientName,
    }));
  }

  async deleteRememberedByClientId(
    userId: string,
    clientId: string,
  ): Promise<boolean> {
    const [client] = await this.drizzleService.client
      .select({ id: oauthClientsTable.id })
      .from(oauthClientsTable)
      .where(eq(oauthClientsTable.clientId, clientId))
      .limit(1);

    if (!client) {
      return false;
    }

    const deleted = await this.drizzleService.client
      .delete(oauthConsentsTable)
      .where(
        and(
          eq(oauthConsentsTable.userId, userId),
          eq(oauthConsentsTable.oauthClientId, client.id),
        ),
      )
      .returning({ id: oauthConsentsTable.id });

    return deleted.length > 0;
  }

  async upsert(
    data: Pick<TNewOAuthConsent, 'userId' | 'oauthClientId' | 'scopes' | 'remember'>,
    tx?: DrizzleTx,
  ): Promise<TOAuthConsent> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .insert(oauthConsentsTable)
      .values(data)
      .onConflictDoUpdate({
        target: [oauthConsentsTable.userId, oauthConsentsTable.oauthClientId],
        set: {
          scopes: data.scopes,
          remember: data.remember,
          updatedAt: new Date(),
        },
      })
      .returning();

    return row;
  }
}
