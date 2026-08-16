import { Module, forwardRef } from '@nestjs/common';
import { OAuthModule } from '@/modules/oauth/oauth.module';
import { OidcBootConfigService } from './oidc-boot.config';
import { OidcClientRegistry } from './oidc-client.registry';
import { OidcJwksService } from './oidc-jwks.service';
import { OidcProviderFactory } from './oidc-provider.factory';
import { OidcService } from './oidc.service';

@Module({
  imports: [forwardRef(() => OAuthModule)],
  providers: [
    OidcBootConfigService,
    OidcJwksService,
    OidcClientRegistry,
    OidcProviderFactory,
    OidcService,
  ],
  exports: [OidcService, OidcClientRegistry, OidcJwksService],
})
export class OidcModule {}
