import { Injectable } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';

export class OidcBootConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OidcBootConfigError';
  }
}

export function assertValidOidcIssuer(issuer: string): void {
  if (issuer.endsWith('/')) {
    throw new OidcBootConfigError(
      'OIDC_ISSUER must not end with a trailing slash',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(issuer);
  } catch {
    throw new OidcBootConfigError('OIDC_ISSUER must be a valid URL');
  }

  if (!parsed.protocol.startsWith('http')) {
    throw new OidcBootConfigError('OIDC_ISSUER must use http or https');
  }
}

@Injectable()
export class OidcBootConfigService {
  constructor(private readonly appEnv: AppEnvService) {}

  validate(): void {
    assertValidOidcIssuer(this.appEnv.OIDC_ISSUER);

    if (
      this.appEnv.isProduction &&
      !this.appEnv.OIDC_JWKS_PRIVATE_KEY_PATH?.trim()
    ) {
      throw new OidcBootConfigError(
        'OIDC_JWKS_PRIVATE_KEY_PATH is required in production',
      );
    }
  }
}
