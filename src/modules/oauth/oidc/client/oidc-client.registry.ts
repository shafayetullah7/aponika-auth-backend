import { Injectable } from '@nestjs/common';
import {
  OAuthClientRepository,
  TOAuthClientWithUris,
} from '@/modules/oauth/oauth-client.repository';
import {
  mapOAuthClientToOidcPayload,
  OidcClientPayload,
} from './oidc-client.mapper';

const DEFAULT_CACHE_TTL_MS = 60_000;

type CacheEntry = {
  expiresAt: number;
  payload: OidcClientPayload;
};

@Injectable()
export class OidcClientRegistry {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = DEFAULT_CACHE_TTL_MS;

  constructor(
    private readonly oauthClientRepository: OAuthClientRepository,
  ) {}

  async findPayload(clientId: string): Promise<OidcClientPayload | undefined> {
    const cached = this.cache.get(clientId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }

    const bundle = await this.oauthClientRepository.findByClientIdWithUris(
      clientId,
    );
    if (!bundle) {
      this.cache.delete(clientId);
      return undefined;
    }

    const payload = mapOAuthClientToOidcPayload(bundle);
    if (!payload) {
      this.cache.delete(clientId);
      return undefined;
    }

    this.cache.set(clientId, {
      payload,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return payload;
  }

  invalidate(clientId?: string): void {
    if (clientId) {
      this.cache.delete(clientId);
      return;
    }

    this.cache.clear();
  }

  /** Test helper — preload cache without hitting the database. */
  seedForTest(clientId: string, bundle: TOAuthClientWithUris): void {
    const payload = mapOAuthClientToOidcPayload(bundle);
    if (!payload) {
      return;
    }

    this.cache.set(clientId, {
      payload,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }
}
