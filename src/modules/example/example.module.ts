import { Module } from '@nestjs/common';
import { JwtResourceGuardModule } from '@/libs/auth/jwt-resource.guard.module';
import { ResponseModule } from '@/libs/response/response.module';
import { ExampleController } from './example.controller';

@Module({
  imports: [JwtResourceGuardModule, ResponseModule],
  controllers: [ExampleController],
})
export class ExampleModule {}
