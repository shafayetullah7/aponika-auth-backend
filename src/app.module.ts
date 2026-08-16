import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import { ZodValidationPipe } from 'nestjs-zod';
import * as path from 'path';
import { DrizzleModule } from './_db/drizzle/drizzle.module';
import configuration from './libs/config/configuration';
import { envSchema } from './libs/config/env.schema';
import { AppConfigModule } from './libs/config/app-config.module';
import { PlatformModule } from './modules/platform/platform.module';
import { AuditModule } from './modules/audit/audit.module';
import { OAuthModule } from './modules/oauth/oauth.module';
import { IdentityModule } from './modules/identity/identity.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';
import { SessionModule } from './modules/session/session.module';
import { ResponseModule } from './libs/response/response.module';
import { CookieModule } from './libs/cookie/cookie.module';
import { PlatformAdminAuthGuardModule } from './libs/guards/platform-admin-auth.guard.module';

@Module({
  imports: [
    DrizzleModule,
    ResponseModule,
    CookieModule,
    PlatformAdminAuthGuardModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
      load: [configuration],
      validate: (config) => envSchema.parse(config),
      expandVariables: true,
    }),
    AppConfigModule,
    PlatformModule,
    AuditModule,
    OAuthModule,
    IdentityModule,
    PlatformAdminModule,
    SessionModule,
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [
        new HeaderResolver(['x-locale']),
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
      ],
    }),
  ],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
