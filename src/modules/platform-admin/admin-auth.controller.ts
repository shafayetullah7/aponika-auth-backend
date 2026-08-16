import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { CookieService } from '@/libs/cookie/cookie.service';
import { CurrentAdmin } from '@/libs/decorators/current-admin.decorator';
import { PlatformAdminAuthGuard } from '@/libs/guards/platform-admin-auth.guard';
import { ResponseService } from '@/libs/response/response.service';
import { AuthenticatedPlatformAdmin } from '@/libs/types/authenticated-platform-admin.type';
import { getClientIp } from '@/libs/utils/get-client-ip';
import { parseDeviceInfo } from '@/libs/utils/parse-device-info';
import { CompleteLocalAdminDto } from './dto/complete-local-admin.dto';
import { CreateLocalAdminDto } from './dto/create-local-admin.dto';
import { LoginLocalAdminDto } from './dto/login-local-admin.dto';
import { PlatformAdminAuthService } from './platform-admin-auth.service';

@ApiTags('Admin Auth')
@Controller({ path: 'admin/auth', version: '1' })
export class AdminAuthController {
  constructor(
    private readonly platformAdminAuthService: PlatformAdminAuthService,
    private readonly cookieService: CookieService,
    private readonly i18n: I18nService,
    private readonly responseService: ResponseService,
  ) {}

  @ApiOperation({
    summary: 'Request admin registration OTP',
    description:
      'Sends a one-time code to ADMIN_REGISTRATION_OTP_EMAIL (global limit: 1 request per minute).',
  })
  @ApiResponse({ status: 200, description: 'Registration OTP sent to gatekeeper' })
  @ApiResponse({ status: 409, description: 'Email or username already exists' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @Post('register/request-otp')
  async requestRegistrationOtp(@Body() payload: CreateLocalAdminDto) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const result = await this.platformAdminAuthService.requestRegistrationOtp(
      payload,
      lang,
    );

    return this.responseService.success({
      message: this.i18n.t('message.success.adminRegistrationOtpSent', {
        lang,
      }),
      data: result,
    });
  }

  @ApiOperation({
    summary: 'Complete admin registration',
    description:
      'Creates a platform admin after OTP verification. Payload must match the request-otp call.',
  })
  @ApiResponse({ status: 201, description: 'Admin successfully registered' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: 409, description: 'Email or username already exists' })
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  async completeRegistration(@Body() payload: CompleteLocalAdminDto) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const result = await this.platformAdminAuthService.completeRegistration(
      payload,
      lang,
    );

    return this.responseService.success({
      message: this.i18n.t('message.success.adminRegistered', { lang }),
      data: result,
    });
  }

  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, description: 'Logged in; cookies set' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  @Post('login')
  async login(
    @Body() payload: LoginLocalAdminDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const userAgent = req.headers['user-agent'] || '';
    const deviceInfo = parseDeviceInfo(userAgent);
    const ip = getClientIp(req);

    const { tokens, admin } = await this.platformAdminAuthService.login(
      payload,
      deviceInfo,
      ip,
      lang,
    );

    this.cookieService.setAdminAccessToken(res, tokens.accessToken);
    this.cookieService.setAdminRefreshToken(res, tokens.refreshToken);
    this.cookieService.setAdminXsrfToken(res, randomUUID());

    return this.responseService.success({
      message: this.i18n.t('message.success.adminLoggedIn', { lang }),
      data: { tokens, admin },
    });
  }

  @ApiOperation({ summary: 'Check admin session' })
  @ApiResponse({ status: 200, description: 'Authenticated admin profile' })
  @UseGuards(PlatformAdminAuthGuard)
  @Get('check')
  checkAuth(@CurrentAdmin() auth: AuthenticatedPlatformAdmin) {
    const lang = I18nContext.current()?.lang ?? 'en';

    return this.responseService.success({
      message: this.i18n.t('message.success.adminAuthenticated', { lang }),
      data: {
        id: auth.admin.id,
        firstName: auth.admin.firstName,
        lastName: auth.admin.lastName,
        userName: auth.admin.userName,
        email: auth.admin.email,
        status: auth.admin.status,
        role: auth.admin.role,
      },
    });
  }

  @ApiOperation({ summary: 'Refresh admin access token' })
  @ApiResponse({ status: 200, description: 'New access token issued' })
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const refreshToken = req.cookies?.adminRefreshToken as string | undefined;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    const { tokens, admin } =
      await this.platformAdminAuthService.refreshTokens(refreshToken);

    this.cookieService.setAdminAccessToken(res, tokens.accessToken);
    this.cookieService.setAdminXsrfToken(res, randomUUID());

    return this.responseService.success({
      message: this.i18n.t('message.success.adminTokenRefreshed', { lang }),
      data: { tokens, admin },
    });
  }

  @ApiOperation({ summary: 'Admin logout' })
  @ApiResponse({ status: 200, description: 'Session revoked; cookies cleared' })
  @UseGuards(PlatformAdminAuthGuard)
  @Post('logout')
  async logout(
    @CurrentAdmin() auth: AuthenticatedPlatformAdmin,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const ip = getClientIp(req);

    await this.platformAdminAuthService.logout(
      auth.session.id,
      auth.admin.id,
      ip,
    );
    this.cookieService.clearAdminTokens(res);

    return this.responseService.success({
      message: this.i18n.t('message.success.adminLoggedOut', { lang }),
      data: null,
    });
  }
}
