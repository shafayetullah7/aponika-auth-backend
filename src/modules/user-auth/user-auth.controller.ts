import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { ResponseService } from '@/libs/response/response.service';
import { getClientIp } from '@/libs/utils/get-client-ip';
import { RegisterUserDto } from './dto/register-user.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { UserAuthService } from './user-auth.service';

@ApiTags('User Auth')
@Controller({ path: 'auth', version: '1' })
export class UserAuthController {
  constructor(
    private readonly userAuthService: UserAuthService,
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
}
