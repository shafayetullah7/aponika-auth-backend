import { Module, forwardRef } from '@nestjs/common';
import { OidcModule } from './oidc/oidc.module';
import { OAuthClientRepository } from './oauth-client.repository';
import { OAuthClientService } from './oauth-client.service';

@Module({
  imports: [forwardRef(() => OidcModule)],
  providers: [OAuthClientRepository, OAuthClientService],
  exports: [OAuthClientRepository, OAuthClientService, OidcModule],
})
export class OAuthModule {}
