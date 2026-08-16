import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import { Injectable } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';

const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class OidcJwksClientService {
  private cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
  private cacheExpiresAt = 0;

  constructor(private readonly appEnv: AppEnvService) {}

  get jwksUrl(): string {
    return new URL('/jwks', this.appEnv.OIDC_ISSUER).toString();
  }

  async verifyAccessToken(
    token: string,
    audience?: string,
  ): Promise<{
    payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
  }> {
    const expectedAudience = audience ?? this.appEnv.OIDC_DEFAULT_RESOURCE;

    try {
      return await jwtVerify(token, await this.getVerifier(), {
        issuer: this.appEnv.OIDC_ISSUER,
        audience: expectedAudience,
      });
    } catch (error) {
      if (this.shouldRetryAfterJwksRefresh(error)) {
        this.invalidateCache();
        return jwtVerify(token, await this.getVerifier(), {
          issuer: this.appEnv.OIDC_ISSUER,
          audience: expectedAudience,
        });
      }

      throw error;
    }
  }

  invalidateCache(): void {
    this.cachedJwks = null;
    this.cacheExpiresAt = 0;
  }

  private async getVerifier(): Promise<ReturnType<typeof createRemoteJWKSet>> {
    if (this.cachedJwks && Date.now() < this.cacheExpiresAt) {
      return this.cachedJwks;
    }

    this.cachedJwks = createRemoteJWKSet(new URL(this.jwksUrl));
    this.cacheExpiresAt = Date.now() + DEFAULT_CACHE_TTL_MS;
    return this.cachedJwks;
  }

  private shouldRetryAfterJwksRefresh(error: unknown): boolean {
    return error instanceof errors.JWSSignatureVerificationFailed;
  }
}
