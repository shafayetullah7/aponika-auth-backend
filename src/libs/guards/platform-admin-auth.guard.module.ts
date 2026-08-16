import { Global, Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PlatformAdminModule } from '@/modules/platform-admin/platform-admin.module';
import { SessionModule } from '@/modules/session/session.module';
import { PlatformAdminAuthGuard } from './platform-admin-auth.guard';

@Global()
@Module({
  imports: [
    JwtModule.register({}),
    SessionModule,
    forwardRef(() => PlatformAdminModule),
  ],
  providers: [PlatformAdminAuthGuard],
  exports: [PlatformAdminAuthGuard, JwtModule],
})
export class PlatformAdminAuthGuardModule {}
