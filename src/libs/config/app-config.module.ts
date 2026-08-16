import { Global, Module } from '@nestjs/common';
import { AppEnvService } from './app-env.service';

@Global()
@Module({
  providers: [AppEnvService],
  exports: [AppEnvService],
})
export class AppConfigModule {}
