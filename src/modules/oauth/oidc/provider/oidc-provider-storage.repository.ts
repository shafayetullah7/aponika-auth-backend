import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import { oidcProviderStorageTable } from '@/_db/drizzle/schema/oauth';
import {
  deserializeOidcStorageValue,
  serializeOidcStorageValue,
} from './oidc-provider-storage.serialization';

type StorageEntry = {
  value: unknown;
  expiresAt: Date | null;
};

@Injectable()
export class OidcProviderStorageRepository {
  constructor(private readonly drizzleService: DrizzleService) {}

  async get(storageKey: string): Promise<unknown | undefined> {
    const entry = await this.getEntry(storageKey);
    return entry?.value;
  }

  async set(
    storageKey: string,
    value: unknown,
    maxAgeMs?: number,
  ): Promise<void> {
    const expiresAt =
      typeof maxAgeMs === 'number' && Number.isFinite(maxAgeMs)
        ? new Date(Date.now() + maxAgeMs)
        : null;

    await this.drizzleService.client
      .insert(oidcProviderStorageTable)
      .values({
        storageKey,
        payload: serializeOidcStorageValue(value),
        expiresAt,
      })
      .onConflictDoUpdate({
        target: oidcProviderStorageTable.storageKey,
        set: {
          payload: serializeOidcStorageValue(value),
          expiresAt,
        },
      });
  }

  async delete(storageKey: string): Promise<void> {
    await this.drizzleService.client
      .delete(oidcProviderStorageTable)
      .where(eq(oidcProviderStorageTable.storageKey, storageKey));
  }

  async replacePayload(storageKey: string, value: unknown): Promise<void> {
    const entry = await this.getEntry(storageKey, { includeExpired: true });
    if (!entry) {
      return;
    }

    await this.drizzleService.client
      .update(oidcProviderStorageTable)
      .set({
        payload: serializeOidcStorageValue(value),
      })
      .where(eq(oidcProviderStorageTable.storageKey, storageKey));
  }

  private async getEntry(
    storageKey: string,
    options: { includeExpired?: boolean } = {},
  ): Promise<StorageEntry | undefined> {
    const [row] = await this.drizzleService.client
      .select()
      .from(oidcProviderStorageTable)
      .where(eq(oidcProviderStorageTable.storageKey, storageKey))
      .limit(1);

    if (!row) {
      return undefined;
    }

    if (
      !options.includeExpired
      && row.expiresAt
      && row.expiresAt.getTime() <= Date.now()
    ) {
      await this.delete(storageKey);
      return undefined;
    }

    return {
      value: deserializeOidcStorageValue(row.payload),
      expiresAt: row.expiresAt,
    };
  }
}
