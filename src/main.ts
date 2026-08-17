import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Application } from 'express';
import { AppModule } from './app.module';
import { AppEnvService } from './libs/config/app-env.service';
import { CorsOriginsService } from './libs/security/cors-origins.service';
import { applySecurityHeaders } from './libs/security/security-headers.middleware';
import { OidcService } from './modules/oauth/oidc/oidc.service';
import { OIDC_GLOBAL_PREFIX_EXCLUSIONS } from './modules/oauth/oidc/provider/oidc-routes.constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.setGlobalPrefix('api', {
    exclude: [...OIDC_GLOBAL_PREFIX_EXCLUSIONS],
  });
  app.use(cookieParser());

  const appEnv = app.get(AppEnvService);
  const corsOrigins = app.get(CorsOriginsService);

  app.use(applySecurityHeaders(appEnv));

  app.enableCors({
    origin: (origin, callback) => {
      void corsOrigins.isAllowed(origin).then((allowed) => {
        if (allowed) {
          callback(null, origin ?? true);
          return;
        }

        callback(null, false);
      });
    },
    credentials: true,
  });

  const oidcService = app.get(OidcService);
  await oidcService.mountOnExpress(
    app.getHttpAdapter().getInstance() as Application,
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Aponika Auth API')
    .setDescription('Identity platform API — OIDC issuer and platform admin.')
    .setVersion('0.0.1')
    .addServer(`http://localhost:${appEnv.APP_EXTERNAL_PORT}/api`, 'Local')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, swaggerDocument);

  await app.listen(appEnv.APP_EXTERNAL_PORT);
}

bootstrap().catch((err) => {
  console.error('Application failed to start', err);
  process.exit(1);
});
