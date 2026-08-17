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
import { CurrentUser } from '@/libs/decorators/current-user.decorator';
import { UserAuthGuard } from '@/libs/guards/user-auth.guard';
import { ResponseService } from '@/libs/response/response.service';
import { AuthenticatedUser } from '@/libs/types/authenticated-user.type';
import { getClientIp } from '@/libs/utils/get-client-ip';
import { parseDeviceInfo } from '@/libs/utils/parse-device-info';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { UserAuthService } from './user-auth.service';

@ApiTags('User Auth')
@Controller({ path: 'auth', version: '1' })
export class UserAuthController {
  constructor(
    private readonly userAuthService: UserAuthService,
    private readonly cookieService: CookieService,
    private readonly i18n: I18nService,
    private readonly responseService: ResponseService,
  ) {}

  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User registered; verification email sent' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  async register(@Body() payload: RegisterUserDto, @Req() req: Request) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const user = await this.userAuthService.register(
      payload,
      lang,
      getClientIp(req),
    );

    return this.responseService.success({
      message: this.i18n.t('message.success.userRegistered', { lang }),
      data: user,
    });
  }

  @ApiOperation({ summary: 'Verify user email address' })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification token' })
  @Post('verify-email')
  async verifyEmail(@Body() payload: VerifyEmailDto) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const result = await this.userAuthService.verifyEmail(payload, lang);

    return this.responseService.success({
      message: this.i18n.t('message.success.userEmailVerified', { lang }),
      data: result,
    });
  }

  @ApiOperation({ summary: 'Resend email verification link' })
  @ApiResponse({ status: 200, description: 'Generic success (anti-enumeration)' })
  @ApiResponse({ status: 429, description: 'Too many resend attempts' })
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  async resendVerification(
    @Body() payload: ResendVerificationDto,
    @Req() req: Request,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';

    await this.userAuthService.resendVerificationEmail(
      payload,
      lang,
      getClientIp(req),
    );

    return this.responseService.success({
      message: this.i18n.t('message.success.userVerificationResent', { lang }),
      data: null,
    });
  }

  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Logged in; cookies set' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  @Post('login')
  async login(
    @Body() payload: LoginUserDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const userAgent = req.headers['user-agent'] || '';
    const deviceInfo = parseDeviceInfo(userAgent);
    const ip = getClientIp(req);

    const { tokens, user } = await this.userAuthService.login(
      payload,
      deviceInfo,
      ip,
      lang,
    );

    this.cookieService.setUserAccessToken(res, tokens.accessToken);
    this.cookieService.setUserRefreshToken(res, tokens.refreshToken);
    this.cookieService.setUserXsrfToken(res, randomUUID());

    return this.responseService.success({
      message: this.i18n.t('message.success.userLoggedIn', { lang }),
      data: { tokens, user },
    });
  }

  @ApiOperation({ summary: 'Check user session' })
  @ApiResponse({ status: 200, description: 'Authenticated user profile' })
  @UseGuards(UserAuthGuard)
  @Get('check')
  checkAuth(@CurrentUser() auth: AuthenticatedUser) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const user = this.userAuthService.getCurrentUser(auth);

    return this.responseService.success({
      message: this.i18n.t('message.success.userAuthenticated', { lang }),
      data: user,
    });
  }

  @ApiOperation({ summary: 'Refresh user access token' })
  @ApiResponse({ status: 200, description: 'New tokens issued (refresh rotated)' })
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const refreshToken = req.cookies?.userRefreshToken as string | undefined;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    const { tokens, user } =
      await this.userAuthService.refreshTokens(refreshToken);

    this.cookieService.setUserAccessToken(res, tokens.accessToken);
    this.cookieService.setUserRefreshToken(res, tokens.refreshToken);

    return this.responseService.success({
      message: this.i18n.t('message.success.userTokenRefreshed', { lang }),
      data: { tokens, user },
    });
  }

  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ status: 200, description: 'Session revoked; cookies cleared' })
  @UseGuards(UserAuthGuard)
  @Post('logout')
  async logout(
    @CurrentUser() auth: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const ip = getClientIp(req);

    await this.userAuthService.logout(
      auth.session.id,
      auth.user.id,
      ip,
    );
    this.cookieService.clearUserTokens(res);

    return this.responseService.success({
      message: this.i18n.t('message.success.userLoggedOut', { lang }),
      data: null,
    });
  }
}
