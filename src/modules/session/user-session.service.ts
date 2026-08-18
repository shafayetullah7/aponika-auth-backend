import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';
import { hashPassword } from '@/libs/crypto/password';
import { DeviceInfo } from '@/libs/utils/parse-device-info';
import { TUserSession } from '@/_db/drizzle/schema/session/user-session.schema';
import {
  isUserSessionActive,
  UserSessionRepository,
  UserSessionWithUser,
} from './user-session.repository';

@Injectable()
export class UserSessionService {
  constructor(
    private readonly userSessionRepository: UserSessionRepository,
    private readonly appEnv: AppEnvService,
  ) {}

  async createSession(input: {
    userId: string;
    deviceInfo: DeviceInfo;
    ip: string;
  }): Promise<TUserSession> {
    const expiresAt = new Date(Date.now() + this.appEnv.SESSION_MAX_AGE);
    const placeholderHash = await hashPassword(
      randomBytes(32).toString('base64url'),
    );

    return this.userSessionRepository.insert({
      userId: input.userId,
      deviceInfo: input.deviceInfo,
      ip: input.ip,
      refreshTokenHash: placeholderHash,
      expiresAt,
    });
  }

  async setRefreshTokenHash(
    sessionId: string,
    refreshToken: string,
  ): Promise<void> {
    await this.userSessionRepository.update(sessionId, {
      refreshTokenHash: await hashPassword(refreshToken),
    });
  }

  async getSessionWithUser(
    sessionId: string,
  ): Promise<UserSessionWithUser | null> {
    return this.userSessionRepository.findByIdWithUser(sessionId);
  }

  isSessionActive(session: TUserSession): boolean {
    return isUserSessionActive(session);
  }

  async revokeSession(sessionId: string): Promise<TUserSession | null> {
    return this.userSessionRepository.revoke(sessionId);
  }

  async revokeAllActiveByUserId(userId: string): Promise<number> {
    return this.userSessionRepository.revokeAllActiveByUserId(userId);
  }
}
