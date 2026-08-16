import { Module } from '@nestjs/common';
import { IdentityRepository } from './identity.repository';

@Module({
  providers: [IdentityRepository],
  exports: [IdentityRepository],
})
export class IdentityModule {}
