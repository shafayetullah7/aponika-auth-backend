import { Global, Module } from '@nestjs/common';
import { OAuthModule } from '@/modules/oauth/oauth.module';
import { CorsOriginsService } from './cors-origins.service';

@Global()
@Module({
  imports: [OAuthModule],
  providers: [CorsOriginsService],
  exports: [CorsOriginsService],
})
export class SecurityModule {}
