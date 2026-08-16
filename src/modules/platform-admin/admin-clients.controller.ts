import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { AuditActionEnum } from '@/_db/drizzle/enum/audit-action.enum';
import { AuditActorTypeEnum } from '@/_db/drizzle/enum/audit-actor-type.enum';
import { OAuthClientTypeEnum } from '@/_db/drizzle/enum';
import { CurrentAdmin } from '@/libs/decorators/current-admin.decorator';
import { PlatformAdminAuthGuard } from '@/libs/guards/platform-admin-auth.guard';
import { ResponseService } from '@/libs/response/response.service';
import { AuthenticatedPlatformAdmin } from '@/libs/types/authenticated-platform-admin.type';
import { getClientIp } from '@/libs/utils/get-client-ip';
import { AuditService } from '@/modules/audit/audit.service';
import { OAuthClientExceptionFilter } from '@/modules/oauth/domain/oauth-client.exception-filter';
import {
  serializeOAuthClientDetail,
  serializeOAuthClientSummary,
} from '@/modules/oauth/domain/oauth-client.serializer';
import { ListOAuthClientsQueryDto } from '@/modules/oauth/dto/list-oauth-clients.query.dto';
import { CreateOAuthClientDto, UpdateOAuthClientDto } from '@/modules/oauth/dto/create-oauth-client.dto';
import { OAuthClientService } from '@/modules/oauth/oauth-client.service';

const BYTE_FORGE_WEB_EXAMPLE = {
  clientId: 'byte-forge-web',
  name: 'Byte Forge Web',
  description: 'Byte Forge marketplace web app',
  clientType: OAuthClientTypeEnum.PUBLIC,
  redirectUris: ['http://localhost:3000/auth/callback'],
  postLogoutRedirectUris: ['http://localhost:3000/'],
  allowedOrigins: ['http://localhost:3000'],
  grantTypes: ['authorization_code', 'refresh_token'],
  responseTypes: ['code'],
  scopes: ['openid', 'profile', 'email'],
  pkceRequired: true,
};

@ApiTags('Admin Clients')
@Controller({ path: 'admin/clients', version: '1' })
@UseGuards(PlatformAdminAuthGuard)
@UseFilters(OAuthClientExceptionFilter)
export class AdminClientsController {
  constructor(
    private readonly oauthClientService: OAuthClientService,
    private readonly auditService: AuditService,
    private readonly i18n: I18nService,
    private readonly responseService: ResponseService,
  ) {}

  @ApiOperation({ summary: 'List OAuth clients' })
  @ApiResponse({ status: 200, description: 'Paginated client list' })
  @Get()
  async list(@Query() query: ListOAuthClientsQueryDto) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const result = await this.oauthClientService.list(query);

    return this.responseService.paginated({
      message: this.i18n.t('message.success.oauthClientsListed', { lang }),
      data: result.items.map(serializeOAuthClientSummary),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
    });
  }

  @ApiOperation({ summary: 'Get OAuth client by id' })
  @ApiResponse({ status: 200, description: 'Client detail with URIs' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const client = await this.oauthClientService.findById(id);

    return this.responseService.success({
      message: this.i18n.t('message.success.oauthClientFetched', { lang }),
      data: serializeOAuthClientDetail(client),
    });
  }

  @ApiOperation({ summary: 'Create OAuth client' })
  @ApiBody({
    description: 'Byte Forge web client example',
    examples: {
      byteForgeWeb: {
        summary: 'byte-forge-web (public + PKCE)',
        value: BYTE_FORGE_WEB_EXAMPLE,
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Client created' })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async create(
    @Body() payload: CreateOAuthClientDto,
    @CurrentAdmin() auth: AuthenticatedPlatformAdmin,
    @Req() req: Request,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const created = await this.oauthClientService.create(
      payload,
      auth.admin.id,
    );

    await this.auditService.record({
      actorType: AuditActorTypeEnum.PLATFORM_ADMIN,
      actorId: auth.admin.id,
      action: AuditActionEnum.CLIENT_CREATED,
      resourceType: 'oauth_client',
      resourceId: created.client.id,
      metadata: { clientId: created.client.clientId },
      ip: getClientIp(req),
    });

    return this.responseService.success({
      message: this.i18n.t('message.success.oauthClientCreated', { lang }),
      data: serializeOAuthClientDetail(created),
    });
  }

  @ApiOperation({ summary: 'Update OAuth client' })
  @ApiResponse({ status: 200, description: 'Client updated' })
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: UpdateOAuthClientDto,
    @CurrentAdmin() auth: AuthenticatedPlatformAdmin,
    @Req() req: Request,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const updated = await this.oauthClientService.update(id, payload);

    await this.auditService.record({
      actorType: AuditActorTypeEnum.PLATFORM_ADMIN,
      actorId: auth.admin.id,
      action: AuditActionEnum.CLIENT_UPDATED,
      resourceType: 'oauth_client',
      resourceId: updated.client.id,
      metadata: { clientId: updated.client.clientId },
      ip: getClientIp(req),
    });

    return this.responseService.success({
      message: this.i18n.t('message.success.oauthClientUpdated', { lang }),
      data: serializeOAuthClientDetail(updated),
    });
  }

  @ApiOperation({ summary: 'Disable OAuth client' })
  @Post(':id/disable')
  async disable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() auth: AuthenticatedPlatformAdmin,
    @Req() req: Request,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const client = await this.oauthClientService.disable(id);

    await this.auditService.record({
      actorType: AuditActorTypeEnum.PLATFORM_ADMIN,
      actorId: auth.admin.id,
      action: AuditActionEnum.CLIENT_DISABLED,
      resourceType: 'oauth_client',
      resourceId: client.id,
      metadata: { clientId: client.clientId },
      ip: getClientIp(req),
    });

    return this.responseService.success({
      message: this.i18n.t('message.success.oauthClientDisabled', { lang }),
      data: serializeOAuthClientSummary(client),
    });
  }

  @ApiOperation({ summary: 'Enable OAuth client' })
  @Post(':id/enable')
  async enable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() auth: AuthenticatedPlatformAdmin,
    @Req() req: Request,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const client = await this.oauthClientService.enable(id);

    await this.auditService.record({
      actorType: AuditActorTypeEnum.PLATFORM_ADMIN,
      actorId: auth.admin.id,
      action: AuditActionEnum.CLIENT_ENABLED,
      resourceType: 'oauth_client',
      resourceId: client.id,
      metadata: { clientId: client.clientId },
      ip: getClientIp(req),
    });

    return this.responseService.success({
      message: this.i18n.t('message.success.oauthClientEnabled', { lang }),
      data: serializeOAuthClientSummary(client),
    });
  }
}
