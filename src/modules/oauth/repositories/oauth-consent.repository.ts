import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import {
  oauthConsentsTable,
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
