import { Module } from '@nestjs/common';
import { AdminSessionRepository } from './admin-session.repository';

@Module({
  providers: [AdminSessionRepository],
  exports: [AdminSessionRepository],
})
export class SessionModule {}
