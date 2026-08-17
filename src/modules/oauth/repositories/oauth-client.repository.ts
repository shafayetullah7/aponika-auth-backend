import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, inArray, SQL } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import {
  OAuthClientStatusEnum,
  OAuthClientUriKindEnum,
  TOAuthClientStatus,
} from '@/_db/drizzle/enum';
import {
  oauthClientRedirectUrisTable,
  oauthClientsTable,
  TNewOAuthClient,
  TNewOAuthClientRedirectUri,
  TOAuthClient,
  TOAuthClientRedirectUri,
} from '@/_db/drizzle/schema/oauth';
import { DrizzleTx } from '@/_db/drizzle/types';

export type TOAuthClientUriInput = Pick<
  TNewOAuthClientRedirectUri,
  'uri' | 'kind'
>;

export type TOAuthClientWithUris = {
  client: TOAuthClient;
  uris: TOAuthClientRedirectUri[];
};

@Injectable()
export class OAuthClientRepository {
  constructor(private readonly drizzleService: DrizzleService) {}

  async insert(
    data: TNewOAuthClient,
    tx?: DrizzleTx,
  ): Promise<TOAuthClient> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .insert(oauthClientsTable)
      .values(data)
      .returning();

    return row;
  }

  async insertUris(
    oauthClientId: string,
    uris: TOAuthClientUriInput[],
    tx?: DrizzleTx,
  ): Promise<TOAuthClientRedirectUri[]> {
    if (uris.length === 0) {
      return [];
    }

    const executor = this.drizzleService.getExecutor(tx);
    return executor
      .insert(oauthClientRedirectUrisTable)
      .values(
        uris.map((uri) => ({
          oauthClientId,
          uri: uri.uri,
          kind: uri.kind,
        })),
      )
      .returning();
  }

  async createWithUris(
    client: TNewOAuthClient,
    uris: TOAuthClientUriInput[],
    tx?: DrizzleTx,
  ): Promise<TOAuthClientWithUris> {
    if (tx) {
      return this.createWithUrisInTx(client, uris, tx);
    }

    return this.drizzleService.transaction((innerTx) =>
      this.createWithUrisInTx(client, uris, innerTx),
    );
  }

  async findById(
    id: string,
    tx?: DrizzleTx,
  ): Promise<TOAuthClient | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(oauthClientsTable)
      .where(eq(oauthClientsTable.id, id))
      .limit(1);

    return row ?? null;
  }

  async findByClientId(
    clientId: string,
    tx?: DrizzleTx,
  ): Promise<TOAuthClient | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(oauthClientsTable)
      .where(eq(oauthClientsTable.clientId, clientId))
      .limit(1);

    return row ?? null;
  }

  async findByClientIdWithUris(
    clientId: string,
    tx?: DrizzleTx,
  ): Promise<TOAuthClientWithUris | null> {
    const client = await this.findByClientId(clientId, tx);
    if (!client) {
      return null;
    }

    const uris = await this.findUrisByClientId(client.id, tx);
    return { client, uris };
  }

  async findUrisByClientId(
    oauthClientId: string,
    tx?: DrizzleTx,
  ): Promise<TOAuthClientRedirectUri[]> {
    const executor = this.drizzleService.getExecutor(tx);
    return executor
      .select()
      .from(oauthClientRedirectUrisTable)
      .where(eq(oauthClientRedirectUrisTable.oauthClientId, oauthClientId));
  }

  async findByIdWithUris(
    id: string,
    tx?: DrizzleTx,
  ): Promise<TOAuthClientWithUris | null> {
    const client = await this.findById(id, tx);
    if (!client) {
      return null;
    }

    const uris = await this.findUrisByClientId(client.id, tx);
    return { client, uris };
  }

  async update(
    id: string,
    data: Partial<TNewOAuthClient>,
    tx?: DrizzleTx,
  ): Promise<TOAuthClient | null> {
    const executor = this.drizzleService.getExecutor(tx);
    const [row] = await executor
      .update(oauthClientsTable)
      .set(data)
      .where(eq(oauthClientsTable.id, id))
      .returning();

    return row ?? null;
  }

  async replaceUris(
    oauthClientId: string,
    uris: TOAuthClientUriInput[],
    tx?: DrizzleTx,
  ): Promise<TOAuthClientRedirectUri[]> {
    if (tx) {
      return this.replaceUrisInTx(oauthClientId, uris, tx);
    }

    return this.drizzleService.transaction((innerTx) =>
      this.replaceUrisInTx(oauthClientId, uris, innerTx),
    );
  }

  async list(
    options: {
      limit: number;
      offset: number;
      status?: TOAuthClientStatus;
    },
    tx?: DrizzleTx,
  ): Promise<TOAuthClient[]> {
    const executor = this.drizzleService.getExecutor(tx);
    const filters: SQL[] = [];

    if (options.status) {
      filters.push(eq(oauthClientsTable.status, options.status));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    return executor
      .select()
      .from(oauthClientsTable)
      .where(whereClause)
      .limit(options.limit)
      .offset(options.offset)
      .orderBy(asc(oauthClientsTable.createdAt));
  }

  async count(status?: TOAuthClientStatus, tx?: DrizzleTx): Promise<number> {
    const executor = this.drizzleService.getExecutor(tx);
    const filters: SQL[] = [];

    if (status) {
      filters.push(eq(oauthClientsTable.status, status));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;
    const [result] = await executor
      .select({ value: count() })
      .from(oauthClientsTable)
      .where(whereClause);

    return Number(result?.value ?? 0);
  }

  async listCorsUrisForActiveClients(tx?: DrizzleTx): Promise<string[]> {
    const executor = this.drizzleService.getExecutor(tx);
    const rows = await executor
      .select({ uri: oauthClientRedirectUrisTable.uri })
      .from(oauthClientRedirectUrisTable)
      .innerJoin(
        oauthClientsTable,
        eq(oauthClientRedirectUrisTable.oauthClientId, oauthClientsTable.id),
      )
      .where(
        and(
          eq(oauthClientsTable.status, OAuthClientStatusEnum.ACTIVE),
          inArray(oauthClientRedirectUrisTable.kind, [
            OAuthClientUriKindEnum.ALLOWED_ORIGIN,
            OAuthClientUriKindEnum.REDIRECT,
          ]),
        ),
      );

    return rows.map((row) => row.uri);
  }

  private async createWithUrisInTx(
    client: TNewOAuthClient,
    uris: TOAuthClientUriInput[],
    tx: DrizzleTx,
  ): Promise<TOAuthClientWithUris> {
    const createdClient = await this.insert(client, tx);
    const createdUris = await this.insertUris(createdClient.id, uris, tx);

    return {
      client: createdClient,
      uris: createdUris,
    };
  }

  private async replaceUrisInTx(
    oauthClientId: string,
    uris: TOAuthClientUriInput[],
    tx: DrizzleTx,
  ): Promise<TOAuthClientRedirectUri[]> {
    await tx
      .delete(oauthClientRedirectUrisTable)
      .where(eq(oauthClientRedirectUrisTable.oauthClientId, oauthClientId));

    return this.insertUris(oauthClientId, uris, tx);
  }
}
