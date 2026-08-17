import { access, readFile } from 'node:fs/promises';
import { Injectable } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';
import { OidcBootConfigError } from './oidc-issuer.validation';

export const OIDC_SIGNING_KID = 'aponika-oidc-1';

export type OidcJwk = Record<string, unknown> & {
  kty?: string;
  use?: string;
  alg?: string;
  kid?: string;
  d?: string;
  n?: string;
  e?: string;
  p?: string;
  q?: string;
  dp?: string;
  dq?: string;
  qi?: string;
};

@Injectable()
export class OidcJwksService {
  constructor(private readonly appEnv: AppEnvService) {}

  async assertPrivateKeyAvailable(): Promise<void> {
    const keyPath = this.appEnv.OIDC_JWKS_PRIVATE_KEY_PATH?.trim();
    if (!keyPath) {
      return;
    }

    try {
      await access(keyPath);
    } catch {
      throw new OidcBootConfigError(
        `OIDC_JWKS_PRIVATE_KEY_PATH file not found: ${keyPath}`,
      );
    }
  }

  /**
   * Returns signing JWKS for oidc-provider configuration.
   * `undefined` → library dev keystore (development only).
   */
  async loadSigningJwks(): Promise<{ keys: OidcJwk[] } | undefined> {
    const keyPath = this.appEnv.OIDC_JWKS_PRIVATE_KEY_PATH?.trim();
    if (!keyPath) {
      return undefined;
    }

    const { exportJWK, importPKCS8 } = await import('jose');
    const pem = await readFile(keyPath, 'utf8');
    const privateKey = await importPKCS8(pem, 'RS256', { extractable: true });
    const jwk = await exportJWK(privateKey);

    return {
      keys: [
        {
          ...jwk,
          use: 'sig',
          alg: 'RS256',
          kid: OIDC_SIGNING_KID,
        },
      ],
    };
  }

  /** Public keys only — safe to expose via `/jwks`. */
  toPublicJwks(jwks: { keys: OidcJwk[] }): { keys: OidcJwk[] } {
    return {
      keys: jwks.keys.map((key) => this.toPublicJwk(key)),
    };
  }

  private toPublicJwk(key: OidcJwk): OidcJwk {
    const {
      d: _d,
      p: _p,
      q: _q,
      dp: _dp,
      dq: _dq,
      qi: _qi,
      ...publicFields
    } = key;

    return publicFields;
  }
}
