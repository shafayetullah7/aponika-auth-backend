import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CookieModule } from '@/libs/cookie/cookie.module';
import { AuditModule } from '@/modules/audit/audit.module';
import { IdentityModule } from '@/modules/identity/identity.module';
import { SessionModule } from '@/modules/session/session.module';
import { UserAuthModule } from '@/modules/user-auth/user-auth.module';
import { OAuthModule } from '@/modules/oauth/oauth.module';
import { OidcAccountService } from './oidc-account.service';
import { OidcBootConfigService } from './oidc-boot.config';
import { OidcClientRegistry } from './oidc-client.registry';
import { OidcInteractionService } from './oidc-interaction.service';
import { OidcJwksService } from './oidc-jwks.service';
import { OidcProviderFactory } from './oidc-provider.factory';
import { OidcResourceConfigService } from './oidc-resource.config';
import { OidcService } from './oidc.service';
import { OidcTokenAuditListener } from './oidc-token-audit.listener';
import { OidcTokenClaimsService } from './oidc-token-claims.service';
import { OidcUserSessionBridge } from './oidc-user-session.bridge';

@Module({
  imports: [
    forwardRef(() => OAuthModule),
    IdentityModule,
    SessionModule,
    CookieModule,
    AuditModule,
    JwtModule.register({}),
    UserAuthModule,
  ],
  providers: [
    OidcBootConfigService,
    OidcJwksService,
    OidcClientRegistry,
    OidcAccountService,
    OidcUserSessionBridge,
    OidcInteractionService,
    OidcResourceConfigService,
    OidcTokenClaimsService,
    OidcTokenAuditListener,
    OidcProviderFactory,
    OidcService,
  ],
  exports: [OidcService, OidcClientRegistry, OidcJwksService],
})
export class OidcModule {}
