import { Injectable } from '@nestjs/common';
import { UserStatusEnum } from '@/_db/drizzle/enum';
import { AuditService } from '@/modules/audit/audit.service';
import {
  IdentityRepository,
  TUserWithCredentialAndProfile,
} from '@/modules/identity/identity.repository';
import { UserSessionRepository } from '@/modules/session/user-session.repository';
import { ListAdminUsersQuery } from './dto/list-admin-users.query.dto';
import { AdminUserNotFoundError } from './domain/admin-user.errors';

@Injectable()
export class AdminUserService {
  constructor(
    private readonly identityRepository: IdentityRepository,
    private readonly userSessionRepository: UserSessionRepository,
    private readonly auditService: AuditService,
  ) {}

  async list(query: ListAdminUsersQuery): Promise<{
    items: TUserWithCredentialAndProfile[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.identityRepository.list({
        limit: query.limit,
        offset,
        status: query.status,
        q: query.q,
      }),
      this.identityRepository.count({
        status: query.status,
        q: query.q,
      }),
    ]);

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findById(id: string): Promise<{
    user: TUserWithCredentialAndProfile;
    sessionCount: number;
    activeSessionCount: number;
    lastLoginAt: Date | null;
  }> {
    const user = await this.identityRepository.findByIdWithCredentialAndProfile(
      id,
    );
    if (!user) {
      throw new AdminUserNotFoundError();
    }

    const [sessionCounts, lastLogin] = await Promise.all([
      this.userSessionRepository.countByUserId(id),
      this.auditService.findLatestUserLogin(id),
    ]);

    return {
      user,
      sessionCount: sessionCounts.total,
      activeSessionCount: sessionCounts.active,
      lastLoginAt: lastLogin?.createdAt ?? null,
    };
  }

  async suspend(id: string): Promise<TUserWithCredentialAndProfile> {
    await this.assertUserExists(id);

    await this.identityRepository.updateStatus(id, UserStatusEnum.SUSPENDED);
    await this.userSessionRepository.revokeAllActiveByUserId(id);

    const updated =
      await this.identityRepository.findByIdWithCredentialAndProfile(id);
    if (!updated) {
      throw new AdminUserNotFoundError();
    }

    return updated;
  }

  async activate(id: string): Promise<TUserWithCredentialAndProfile> {
    await this.assertUserExists(id);

    await this.identityRepository.updateStatus(id, UserStatusEnum.ACTIVE);

    const updated =
      await this.identityRepository.findByIdWithCredentialAndProfile(id);
    if (!updated) {
      throw new AdminUserNotFoundError();
    }

    return updated;
  }

  private async assertUserExists(
    id: string,
  ): Promise<TUserWithCredentialAndProfile> {
    const user = await this.identityRepository.findByIdWithCredentialAndProfile(
      id,
    );
    if (!user) {
      throw new AdminUserNotFoundError();
    }

    return user;
  }
}
