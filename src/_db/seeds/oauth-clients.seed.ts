import { eq } from 'drizzle-orm';
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

export async function seedOAuthClients(): Promise<void> {
  console.log('🌱 Seeding OAuth clients for local dev...');

  for (const definition of DEV_OAUTH_CLIENTS) {
    const [existing] = await seedDb
      .select({ id: oauthClientsTable.id })
      .from(oauthClientsTable)
      .where(eq(oauthClientsTable.clientId, definition.clientId))
      .limit(1);

    if (existing) {
      console.log(`⏭️  Skipping ${definition.clientId} (already exists)`);
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
