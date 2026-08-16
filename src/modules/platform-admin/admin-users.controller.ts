import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { AuditActionEnum } from '@/_db/drizzle/enum/audit-action.enum';
import { AuditActorTypeEnum } from '@/_db/drizzle/enum/audit-actor-type.enum';
import { CurrentAdmin } from '@/libs/decorators/current-admin.decorator';
import { PlatformAdminAuthGuard } from '@/libs/guards/platform-admin-auth.guard';
import { ResponseService } from '@/libs/response/response.service';
import { AuthenticatedPlatformAdmin } from '@/libs/types/authenticated-platform-admin.type';
import { getClientIp } from '@/libs/utils/get-client-ip';
import { AuditService } from '@/modules/audit/audit.service';
import { AdminUserService } from './admin-user.service';
import { AdminUserExceptionFilter } from './domain/admin-user.exception-filter';
import {
  serializeAdminUserDetail,
  serializeAdminUserSummary,
} from './domain/admin-user.serializer';
import { serializeAdminUserSession } from './domain/admin-user-session.serializer';
import { ListAdminUsersQueryDto } from './dto/list-admin-users.query.dto';
import { ListAdminUserSessionsQueryDto } from './dto/list-admin-user-sessions.query.dto';

@ApiTags('Admin Users')
@Controller({ path: 'admin/users', version: '1' })
@UseGuards(PlatformAdminAuthGuard)
@UseFilters(AdminUserExceptionFilter)
export class AdminUsersController {
  constructor(
    private readonly adminUserService: AdminUserService,
    private readonly auditService: AuditService,
    private readonly i18n: I18nService,
    private readonly responseService: ResponseService,
  ) {}

  @ApiOperation({ summary: 'List identity platform users' })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  @Get()
  async list(@Query() query: ListAdminUsersQueryDto) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const result = await this.adminUserService.list(query);

    return this.responseService.paginated({
      message: this.i18n.t('message.success.adminUsersListed', { lang }),
      data: result.items.map(serializeAdminUserSummary),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
    });
  }

  @ApiOperation({ summary: 'List user sessions' })
  @ApiResponse({ status: 200, description: 'Paginated session list' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get(':id/sessions')
  async listSessions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListAdminUserSessionsQueryDto,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const result = await this.adminUserService.listSessions(id, query);

    return this.responseService.paginated({
      message: this.i18n.t('message.success.adminUserSessionsListed', { lang }),
      data: result.items.map(serializeAdminUserSession),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
    });
  }

  @ApiOperation({ summary: 'Revoke user session' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  @ApiResponse({ status: 404, description: 'User or session not found' })
  @Delete(':id/sessions/:sessionId')
  async revokeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @CurrentAdmin() auth: AuthenticatedPlatformAdmin,
    @Req() req: Request,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const session = await this.adminUserService.revokeSession(id, sessionId);

    await this.auditService.record({
      actorType: AuditActorTypeEnum.PLATFORM_ADMIN,
      actorId: auth.admin.id,
      action: AuditActionEnum.USER_SESSION_REVOKED,
      resourceType: 'user_session',
      resourceId: session.id,
      metadata: { userId: id },
      ip: getClientIp(req),
    });

    return this.responseService.success({
      message: this.i18n.t('message.success.adminUserSessionRevoked', { lang }),
      data: serializeAdminUserSession(session),
    });
  }

  @ApiOperation({ summary: 'Get user by id' })
  @ApiResponse({ status: 200, description: 'User detail with auth summary' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const result = await this.adminUserService.findById(id);

    return this.responseService.success({
      message: this.i18n.t('message.success.adminUserFetched', { lang }),
      data: serializeAdminUserDetail(result.user, {
        sessionCount: result.sessionCount,
        activeSessionCount: result.activeSessionCount,
        lastLoginAt: result.lastLoginAt,
      }),
    });
  }

  @ApiOperation({ summary: 'Suspend user' })
  @ApiResponse({ status: 200, description: 'User suspended' })
  @Post(':id/suspend')
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() auth: AuthenticatedPlatformAdmin,
    @Req() req: Request,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const user = await this.adminUserService.suspend(id);

    await this.auditService.record({
      actorType: AuditActorTypeEnum.PLATFORM_ADMIN,
      actorId: auth.admin.id,
      action: AuditActionEnum.USER_SUSPENDED,
      resourceType: 'user',
      resourceId: user.user.id,
      metadata: { email: user.user.email },
      ip: getClientIp(req),
    });

    return this.responseService.success({
      message: this.i18n.t('message.success.adminUserSuspended', { lang }),
      data: serializeAdminUserSummary(user),
    });
  }

  @ApiOperation({ summary: 'Activate user' })
  @ApiResponse({ status: 200, description: 'User activated' })
  @Post(':id/activate')
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() auth: AuthenticatedPlatformAdmin,
    @Req() req: Request,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const user = await this.adminUserService.activate(id);

    await this.auditService.record({
      actorType: AuditActorTypeEnum.PLATFORM_ADMIN,
      actorId: auth.admin.id,
      action: AuditActionEnum.USER_ACTIVATED,
      resourceType: 'user',
      resourceId: user.user.id,
      metadata: { email: user.user.email },
      ip: getClientIp(req),
    });

    return this.responseService.success({
      message: this.i18n.t('message.success.adminUserActivated', { lang }),
      data: serializeAdminUserSummary(user),
    });
  }
}
