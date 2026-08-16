import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { PlatformAdminAuthGuard } from '@/libs/guards/platform-admin-auth.guard';
import { ResponseService } from '@/libs/response/response.service';
import { AuditService } from '@/modules/audit/audit.service';
import { serializeAuditEvent } from '@/modules/audit/audit.serializer';
import { ListAdminAuditEventsQueryDto } from './dto/list-admin-audit-events.query.dto';

@ApiTags('Admin Audit')
@Controller({ path: 'admin/audit-events', version: '1' })
@UseGuards(PlatformAdminAuthGuard)
export class AdminAuditEventsController {
  constructor(
    private readonly auditService: AuditService,
    private readonly i18n: I18nService,
    private readonly responseService: ResponseService,
  ) {}

  @ApiOperation({ summary: 'List platform audit events' })
  @ApiResponse({ status: 200, description: 'Paginated audit log' })
  @Get()
  async list(@Query() query: ListAdminAuditEventsQueryDto) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const result = await this.auditService.list({
      page: query.page,
      limit: query.limit,
      action: query.action,
      actorId: query.actor,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });

    return this.responseService.paginated({
      message: this.i18n.t('message.success.adminAuditEventsListed', { lang }),
      data: result.items.map(serializeAuditEvent),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
    });
  }
}
