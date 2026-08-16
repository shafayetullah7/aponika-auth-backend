import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Application } from 'express';
import { OidcBootConfigService } from './oidc-boot.config';
import { OidcProviderFactory, OidcProviderInstance } from './oidc-provider.factory';

const OIDC_HTTP_PREFIXES = [
  '/.well-known',
  '/auth',
  '/token',
  '/reg',
  '/me',
  '/jwks',
  '/device',
  '/revocation',
  '/introspection',
  '/session',
] as const;

export function isOidcHttpPath(path: string): boolean {
  return OIDC_HTTP_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

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
    this.bootConfig.validate();
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

    this.logger.log('OIDC HTTP routes mounted (dev bootstrap — authorize flow ships in F23)');
  }
}
