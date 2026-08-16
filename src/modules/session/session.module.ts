import { Module } from '@nestjs/common';
import { AdminSessionRepository } from './admin-session.repository';
import { AdminSessionService } from './admin-session.service';
import { UserSessionRepository } from './user-session.repository';
import { UserSessionService } from './user-session.service';

@Module({
  providers: [
    AdminSessionRepository,
    AdminSessionService,
    UserSessionRepository,
    UserSessionService,
  ],
  exports: [
    AdminSessionRepository,
    AdminSessionService,
    UserSessionRepository,
    UserSessionService,
  ],
})
export class SessionModule {}
