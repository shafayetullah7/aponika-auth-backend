import { and, eq } from 'drizzle-orm';
import {
  oauthClientRedirectUrisTable,
  oauthClientsTable,
} from '@/_db/drizzle/schema/oauth';
import { validateUriBundle } from '@/modules/oauth/domain/oauth-client-uri.validation';
import { seedDb } from './db';
import {
  DEV_OAUTH_CLIENTS,
  DEV_OAUTH_CLIENT_DEFAULTS,
  toUriRows,
} from './dev-oauth-clients.data';

async function syncClientUris(
  oauthClientId: string,
  definition: (typeof DEV_OAUTH_CLIENTS)[number],
): Promise<void> {
  const uriBundle = validateUriBundle({
    redirectUris: definition.redirectUris,
    postLogoutRedirectUris: definition.postLogoutRedirectUris,
    allowedOrigins: definition.allowedOrigins,
  });
  const uriRows = toUriRows(uriBundle);
  const desired = new Set(uriRows.map((row) => `${row.kind}\0${row.uri}`));

  for (const row of uriRows) {
    const [existingUri] = await seedDb
      .select({ id: oauthClientRedirectUrisTable.id })
      .from(oauthClientRedirectUrisTable)
      .where(
        and(
          eq(oauthClientRedirectUrisTable.oauthClientId, oauthClientId),
          eq(oauthClientRedirectUrisTable.kind, row.kind),
          eq(oauthClientRedirectUrisTable.uri, row.uri),
        ),
      )
      .limit(1);

    if (!existingUri) {
      await seedDb.insert(oauthClientRedirectUrisTable).values({
        oauthClientId,
        uri: row.uri,
        kind: row.kind,
      });
      console.log(
        `➕ Added ${row.kind} URI for ${definition.clientId}: ${row.uri}`,
      );
    }
  }

  const existingRows = await seedDb
    .select({
      id: oauthClientRedirectUrisTable.id,
      kind: oauthClientRedirectUrisTable.kind,
      uri: oauthClientRedirectUrisTable.uri,
    })
    .from(oauthClientRedirectUrisTable)
    .where(eq(oauthClientRedirectUrisTable.oauthClientId, oauthClientId));

  for (const row of existingRows) {
    const key = `${row.kind}\0${row.uri}`;
    if (desired.has(key)) {
      continue;
    }
    await seedDb
      .delete(oauthClientRedirectUrisTable)
      .where(eq(oauthClientRedirectUrisTable.id, row.id));
    console.log(
      `➖ Removed ${row.kind} URI for ${definition.clientId}: ${row.uri}`,
    );
  }
}

export async function seedOAuthClients(): Promise<void> {
  console.log('🌱 Seeding OAuth clients for local dev...');

  for (const definition of DEV_OAUTH_CLIENTS) {
    const [existing] = await seedDb
      .select({ id: oauthClientsTable.id })
      .from(oauthClientsTable)
      .where(eq(oauthClientsTable.clientId, definition.clientId))
      .limit(1);

    if (existing) {
      await seedDb
        .update(oauthClientsTable)
        .set({
          trustedFirstParty: definition.trustedFirstParty ?? false,
        })
        .where(eq(oauthClientsTable.clientId, definition.clientId));
      await syncClientUris(existing.id, definition);
      console.log(`🔄 Synced ${definition.clientId} trusted_first_party + URIs`);
      continue;
    }

    const uriBundle = validateUriBundle({
      redirectUris: definition.redirectUris,
      postLogoutRedirectUris: definition.postLogoutRedirectUris,
      allowedOrigins: definition.allowedOrigins,
    });

    await seedDb.transaction(async (tx) => {
      const [client] = await tx
        .insert(oauthClientsTable)
        .values({
          clientId: definition.clientId,
          name: definition.name,
          description: definition.description,
          clientType: definition.clientType,
          grantTypes: DEV_OAUTH_CLIENT_DEFAULTS.grantTypes,
          responseTypes: DEV_OAUTH_CLIENT_DEFAULTS.responseTypes,
          scopes: DEV_OAUTH_CLIENT_DEFAULTS.scopes,
          pkceRequired: DEV_OAUTH_CLIENT_DEFAULTS.pkceRequired,
          trustedFirstParty: definition.trustedFirstParty ?? false,
          status: DEV_OAUTH_CLIENT_DEFAULTS.status,
          clientSecretHash: null,
          createdBy: null,
        })
        .returning();

      const uriRows = toUriRows(uriBundle);
      if (uriRows.length > 0) {
        await tx.insert(oauthClientRedirectUrisTable).values(
          uriRows.map((row) => ({
            oauthClientId: client.id,
            uri: row.uri,
            kind: row.kind,
          })),
        );
      }

      console.log(`✅ Created ${definition.clientId}`);
    });
  }

  console.log('✨ OAuth client seeding complete');
}
