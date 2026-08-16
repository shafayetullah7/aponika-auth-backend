import { Module } from '@nestjs/common';
import { AdminSessionRepository } from './admin-session.repository';
import { AdminSessionService } from './admin-session.service';

@Module({
  providers: [AdminSessionRepository, AdminSessionService],
  exports: [AdminSessionRepository, AdminSessionService],
})
export class SessionModule {}
