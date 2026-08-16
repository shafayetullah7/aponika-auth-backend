import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Application } from 'express';
import { OidcBootConfigService } from './oidc-boot.config';
import { OidcProviderFactory, OidcProviderInstance } from './oidc-provider.factory';
import { isOidcHttpPath } from './oidc-routes.constants';

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
  ) {}

  async onModuleInit(): Promise<void> {
    await this.bootConfig.validate();
    this.provider = await this.providerFactory.create();
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

    app.use((req, res, next) => {
      if (!isOidcHttpPath(req.path)) {
        next();
        return;
      }

      handler(req, res, next);
    });

    this.logger.log('OIDC discovery and protocol routes mounted at issuer root');
  }
}
