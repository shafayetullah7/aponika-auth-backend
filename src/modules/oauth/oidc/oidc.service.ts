import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Application, NextFunction, Request, Response } from 'express';
import { OidcBootConfigService } from './oidc-boot.config';
import { OidcInteractionService } from './oidc-interaction.service';
import {
  OidcProviderFactory,
  OidcProviderInstance,
} from './oidc-provider.factory';
import { OidcTokenAuditListener } from './oidc-token-audit.listener';
import {
  isOidcHttpPath,
  OIDC_INTERACTION_PATH_PREFIX,
} from './oidc-routes.constants';

@Injectable()
export class OidcService implements OnModuleInit {
  private readonly logger = new Logger(OidcService.name);
  private provider: OidcProviderInstance | null = null;
  private callback:
    | ((req: unknown, res: unknown, next?: () => void) => void)
    | null = null;

  constructor(
    private readonly bootConfig: OidcBootConfigService,
    private readonly providerFactory: OidcProviderFactory,
    private readonly interactionService: OidcInteractionService,
    private readonly tokenAuditListener: OidcTokenAuditListener,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.bootConfig.validate();
    this.provider = await this.providerFactory.create();
    this.tokenAuditListener.attach(this.provider);
    this.callback = this.provider.callback();
    this.logger.log(`OIDC provider initialized for ${this.provider.issuer}`);
  }

  getProvider(): OidcProviderInstance {
    if (!this.provider) {
      throw new ServiceUnavailableException('OIDC provider is not initialized');
    }

    return this.provider;
  }

  mountOnExpress(app: Application): void {
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
