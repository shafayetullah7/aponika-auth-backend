import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';
import { hashPassword } from '@/libs/crypto/password';
import { DeviceInfo } from '@/libs/utils/parse-device-info';
import { TAdminSession } from '@/_db/drizzle/schema/session/admin-session.schema';
import {
  AdminSessionRepository,
  AdminSessionWithAdmin,
  isAdminSessionActive,
} from './admin-session.repository';

@Injectable()
export class AdminSessionService {
  constructor(
    private readonly adminSessionRepository: AdminSessionRepository,
    private readonly appEnv: AppEnvService,
  ) {}

  async createSession(input: {
    adminId: string;
    deviceInfo: DeviceInfo;
    ip: string;
  }): Promise<TAdminSession> {
    const expiresAt = new Date(Date.now() + this.appEnv.SESSION_MAX_AGE);
    const placeholderHash = await hashPassword(
      randomBytes(32).toString('base64url'),
    );

    return this.adminSessionRepository.insert({
      adminId: input.adminId,
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
    await this.adminSessionRepository.update(sessionId, {
      refreshTokenHash: await hashPassword(refreshToken),
    });
  }

  async getSessionWithAdmin(
    sessionId: string,
  ): Promise<AdminSessionWithAdmin | null> {
    return this.adminSessionRepository.findByIdWithAdmin(sessionId);
  }

  isSessionActive(session: TAdminSession): boolean {
    return isAdminSessionActive(session);
  }

  async revokeSession(sessionId: string): Promise<TAdminSession | null> {
    return this.adminSessionRepository.revoke(sessionId);
  }
}
