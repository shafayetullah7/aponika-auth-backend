import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';
import { OAuthClientRepository } from '@/modules/oauth/oauth-client.repository';
import { getAllowedOrigins } from './allowed-origins';

const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class CorsOriginsService implements OnModuleInit {
  private cache: string[] = [];
  private cacheExpiresAt = 0;

  constructor(
    private readonly appEnv: AppEnvService,
    private readonly oauthClientRepository: OAuthClientRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  async isAllowed(origin: string | undefined): Promise<boolean> {
    if (!origin) {
      return true;
    }

    if (Date.now() >= this.cacheExpiresAt) {
      await this.refresh();
    }

    return this.cache.includes(origin);
  }

  async refresh(): Promise<string[]> {
    const origins = new Set<string>(getAllowedOrigins(this.appEnv));

    try {
      origins.add(new URL(this.appEnv.AUTH_FRONTEND_URL).origin);
    } catch {
      // ignore invalid AUTH_FRONTEND_URL
    }

    const clientUris =
      await this.oauthClientRepository.listCorsUrisForActiveClients();

    for (const uri of clientUris) {
      try {
        origins.add(new URL(uri).origin);
      } catch {
        // skip malformed URIs
      }
    }

    this.cache = [...origins];
    this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return this.cache;
  }
}
