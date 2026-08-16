import { Module, forwardRef } from '@nestjs/common';
import { OAuthModule } from '@/modules/oauth/oauth.module';
import { OidcBootConfigService } from './oidc-boot.config';
import { OidcClientRegistry } from './oidc-client.registry';
import { OidcProviderFactory } from './oidc-provider.factory';
import { OidcService } from './oidc.service';

@Module({
  imports: [forwardRef(() => OAuthModule)],
  providers: [
    OidcBootConfigService,
    OidcClientRegistry,
    OidcProviderFactory,
    OidcService,
  ],
  exports: [OidcService, OidcClientRegistry],
})
export class OidcModule {}
