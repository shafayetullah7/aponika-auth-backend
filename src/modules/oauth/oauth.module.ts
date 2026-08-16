import { Module, forwardRef } from '@nestjs/common';
import { OidcModule } from './oidc/oidc.module';
import { OAuthClientRepository } from './oauth-client.repository';
import { OAuthClientService } from './oauth-client.service';
import { OAuthConsentRepository } from './oauth-consent.repository';

@Module({
  imports: [forwardRef(() => OidcModule)],
  providers: [OAuthClientRepository, OAuthClientService, OAuthConsentRepository],
  exports: [
    OAuthClientRepository,
    OAuthClientService,
    OAuthConsentRepository,
    OidcModule,
  ],
})
export class OAuthModule {}
