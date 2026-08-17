import { Injectable } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';
import { OidcJwksService } from './oidc-jwks.service';
import {
  assertValidOidcIssuer,
  OidcBootConfigError,
} from './oidc-issuer.validation';

export { OidcBootConfigError, assertValidOidcIssuer } from './oidc-issuer.validation';

@Injectable()
export class OidcBootConfigService {
  constructor(
    private readonly appEnv: AppEnvService,
    private readonly jwksService: OidcJwksService,
  ) {}

  async validate(): Promise<void> {
    assertValidOidcIssuer(this.appEnv.OIDC_ISSUER);

    if (
      this.appEnv.isProduction &&
      !this.appEnv.OIDC_JWKS_PRIVATE_KEY_PATH?.trim()
    ) {
      throw new OidcBootConfigError(
        'OIDC_JWKS_PRIVATE_KEY_PATH is required in production',
      );
    }

    await this.jwksService.assertPrivateKeyAvailable();
  }
}
