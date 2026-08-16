import { Global, Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SessionModule } from '@/modules/session/session.module';
import { UserAuthModule } from '@/modules/user-auth/user-auth.module';
import { UserAuthGuard } from './user-auth.guard';

@Global()
@Module({
  imports: [
    JwtModule.register({}),
    SessionModule,
    forwardRef(() => UserAuthModule),
  ],
  providers: [UserAuthGuard],
  exports: [UserAuthGuard, JwtModule],
})
export class UserAuthGuardModule {}
