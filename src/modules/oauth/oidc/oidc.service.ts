import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Application, NextFunction, Request, Response } from 'express';
import { OidcBootConfigService } from './boot/oidc-boot.config';
import { OidcEndSessionListener } from './logout/oidc-end-session.listener';
import { OidcInteractionService } from './login/oidc-interaction.service';
import {
  OidcProviderFactory,
  OidcProviderInstance,
} from './provider/oidc-provider.factory';
import { OidcTokenRateLimiterService } from './token/oidc-token-rate-limiter.service';
import { OidcTokenAuditListener } from './token/oidc-token-audit.listener';
import {
  isOidcHttpPath,
  OIDC_INTERACTION_PATH_PREFIX,
  OIDC_ROUTE_PATHS,
} from './provider/oidc-routes.constants';
import { getClientIp } from '@/libs/utils/get-client-ip';
import { CustomException } from '@/libs/exceptions/custom.exception';

@Injectable()
export class OidcService implements OnModuleInit {
  private readonly logger = new Logger(OidcService.name);
  private provider: OidcProviderInstance | null = null;
  private callback:
    | ((req: unknown, res: unknown, next?: () => void) => void)
    | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(
    private readonly bootConfig: OidcBootConfigService,
    private readonly providerFactory: OidcProviderFactory,
    private readonly interactionService: OidcInteractionService,
    private readonly tokenAuditListener: OidcTokenAuditListener,
    private readonly endSessionListener: OidcEndSessionListener,
    private readonly tokenRateLimiter: OidcTokenRateLimiterService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  private initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInitialize().catch((error: unknown) => {
        this.initPromise = null;
        this.logger.error('OIDC provider initialization failed', error);
        throw error;
      });
    }

    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    await this.bootConfig.validate();
    this.provider = await this.providerFactory.create();
    this.tokenAuditListener.attach(this.provider);
    this.endSessionListener.attach(this.provider);
    this.callback = this.provider.callback();
    this.logger.log(`OIDC provider initialized for ${this.provider.issuer}`);
  }

  getProvider(): OidcProviderInstance {
    if (!this.provider) {
      throw new ServiceUnavailableException('OIDC provider is not initialized');
    }

    return this.provider;
  }

  async mountOnExpress(app: Application): Promise<void> {
    await this.initialize();

    if (!this.callback) {
      throw new ServiceUnavailableException('OIDC provider is not initialized');
    }

    const handler = this.callback;

    app.get(
      `${OIDC_INTERACTION_PATH_PREFIX}/:uid`,
      (req: Request, res: Response, next: NextFunction) => {
        this.interactionService
          .resume(req, res, this.getProvider())
          .catch(next);
      },
    );

    app.use((req, res, next) => {
      if (req.method === 'POST' && req.path === OIDC_ROUTE_PATHS.token) {
        try {
          const key = getClientIp(req) ?? 'unknown';
          this.tokenRateLimiter.assertCanAttempt(key);
          this.tokenRateLimiter.recordAttempt(key);
        } catch (error) {
          if (error instanceof CustomException) {
            res.status(error.getStatus()).json({
              error: 'too_many_requests',
              error_description: error.message,
            });
            return;
          }

          next(error);
          return;
        }
      }

      if (!isOidcHttpPath(req.path)) {
        next();
        return;
      }

      handler(req, res, next);
    });

    this.logger.log(
      'OIDC discovery, authorize, and interaction routes mounted at issuer root',
    );
  }
}
