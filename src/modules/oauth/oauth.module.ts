import { Module } from '@nestjs/common';
import { OAuthClientRepository } from './oauth-client.repository';
import { OAuthClientService } from './oauth-client.service';

@Module({
  providers: [OAuthClientRepository, OAuthClientService],
  exports: [OAuthClientRepository, OAuthClientService],
})
export class OAuthModule {}
