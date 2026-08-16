import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Application } from 'express';
import { AppModule } from './app.module';
import { AppEnvService } from './libs/config/app-env.service';
import { getAllowedOrigins } from './libs/security/allowed-origins';
import { OidcService } from './modules/oauth/oidc/oidc.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.use(cookieParser());

  const appEnv = app.get(AppEnvService);

  app.enableCors({
    origin: getAllowedOrigins(appEnv),
    credentials: true,
  });

  const oidcService = app.get(OidcService);
  oidcService.mountOnExpress(app.getHttpAdapter().getInstance() as Application);

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
