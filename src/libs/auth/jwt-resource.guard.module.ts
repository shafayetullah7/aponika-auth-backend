import { Module } from '@nestjs/common';
import { AppConfigModule } from '@/libs/config/app-config.module';
import { JwtResourceGuard } from './jwt-resource.guard';
import { OidcJwksClientService } from './oidc-jwks-client.service';

@Module({
  imports: [AppConfigModule],
  providers: [OidcJwksClientService, JwtResourceGuard],
  exports: [OidcJwksClientService, JwtResourceGuard],
})
export class JwtResourceGuardModule {}
