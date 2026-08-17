import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CookieModule } from '@/libs/cookie/cookie.module';
import { ResponseModule } from '@/libs/response/response.module';
import { AuditModule } from '@/modules/audit/audit.module';
import { IdentityModule } from '@/modules/identity/identity.module';
import { SessionModule } from '@/modules/session/session.module';
import { UserAuthModule } from '@/modules/user-auth/user-auth.module';
import { OAuthModule } from '@/modules/oauth/oauth.module';
import { OidcBootConfigService } from './boot/oidc-boot.config';
import { OidcClientRegistry } from './client/oidc-client.registry';
import { OidcConsentController } from './consent/oidc-consent.controller';
import { OidcConsentGrantService } from './consent/oidc-consent-grant.service';
import { OidcAccountService } from './login/oidc-account.service';
import { OidcHostedErrorService } from './login/oidc-hosted-error.service';
import { OidcInteractionService } from './login/oidc-interaction.service';
import { OidcUserSessionBridge } from './login/oidc-user-session.bridge';
import { OidcEndSessionListener } from './logout/oidc-end-session.listener';
import { OidcLogoutUiService } from './logout/oidc-logout-ui.service';
import { OidcJwksService } from './boot/oidc-jwks.service';
import { OidcProviderFactory } from './provider/oidc-provider.factory';
import { OidcService } from './oidc.service';
import { OidcResourceConfigService } from './token/oidc-resource.config';
import { OidcTokenAuditListener } from './token/oidc-token-audit.listener';
import { OidcTokenClaimsService } from './token/oidc-token-claims.service';
import { OidcTokenRateLimiterService } from './token/oidc-token-rate-limiter.service';

@Module({
  imports: [
    forwardRef(() => OAuthModule),
    IdentityModule,
    SessionModule,
    CookieModule,
    ResponseModule,
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
    OidcConsentGrantService,
    OidcHostedErrorService,
    OidcLogoutUiService,
    OidcEndSessionListener,
    OidcResourceConfigService,
    OidcTokenClaimsService,
    OidcTokenAuditListener,
    OidcTokenRateLimiterService,
    OidcProviderFactory,
    OidcService,
  ],
  controllers: [OidcConsentController],
  exports: [OidcService, OidcClientRegistry, OidcJwksService],
})
export class OidcModule {}
