import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '@/libs/decorators/current-user.decorator';
import { UserAuthGuard } from '@/libs/guards/user-auth.guard';
import { ResponseService } from '@/libs/response/response.service';
import { AuthenticatedUser } from '@/libs/types/authenticated-user.type';
import { submitOidcConsentSchema } from '../../dto/oauth-consent.schema';
import { OidcInteractionService } from '@/modules/oauth/oidc/login/oidc-interaction.service';
import { OidcService } from '@/modules/oauth/oidc/oidc.service';

@ApiTags('OAuth Consent')
@Controller({ path: 'oauth/consent', version: '1' })
@UseGuards(UserAuthGuard)
export class OidcConsentController {
  constructor(
    private readonly oidcService: OidcService,
    private readonly interactionService: OidcInteractionService,
    private readonly responseService: ResponseService,
  ) {}

  @ApiOperation({ summary: 'Get OAuth consent prompt details for an interaction' })
  @ApiResponse({ status: 200, description: 'Consent prompt details' })
  @Get('interactions/:uid')
  async getInteraction(
    @Param('uid') uid: string,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const details = await this.interactionService.getConsentPromptDetails(
      req,
      uid,
      user.user.id,
      this.oidcService.getProvider(),
    );

    return this.responseService.success({
      message: 'Consent prompt loaded',
      data: details,
    });
  }

  @ApiOperation({ summary: 'Allow OAuth consent for an interaction' })
  @ApiResponse({ status: 200, description: 'Consent granted; redirect URL returned' })
  @Post('interactions/:uid/allow')
  async allowInteraction(
    @Param('uid') uid: string,
    @Body() body: unknown,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const payload = submitOidcConsentSchema.parse(body);
    const result = await this.interactionService.allowConsent(
      req,
      uid,
      user.user.id,
      payload.remember,
      this.oidcService.getProvider(),
    );

    return this.responseService.success({
      message: 'Consent granted',
      data: result,
    });
  }

  @ApiOperation({ summary: 'Deny OAuth consent for an interaction' })
  @ApiResponse({ status: 200, description: 'Consent denied; redirect URL returned' })
  @Post('interactions/:uid/deny')
  async denyInteraction(
    @Param('uid') uid: string,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.interactionService.denyConsent(
      req,
      uid,
      user.user.id,
      this.oidcService.getProvider(),
    );

    return this.responseService.success({
      message: 'Consent denied',
      data: result,
    });
  }
}
