import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { ResponseService } from '@/libs/response/response.service';
import { getClientIp } from '@/libs/utils/get-client-ip';
import {
  ConfirmPasswordResetDto,
  RequestPasswordResetDto,
  VerifyPasswordResetOtpDto,
} from './dto/password-reset.dto';
import { PasswordResetService } from './password-reset.service';

@ApiTags('Password Reset')
@Controller({ path: 'auth/password-reset', version: '1' })
export class PasswordResetController {
  constructor(
    private readonly passwordResetService: PasswordResetService,
    private readonly i18n: I18nService,
    private readonly responseService: ResponseService,
  ) {}

  @ApiOperation({ summary: 'Request password reset OTP' })
  @ApiResponse({ status: 200, description: 'Reset flow started' })
  @HttpCode(HttpStatus.OK)
  @Post('request')
  async requestReset(
    @Body() payload: RequestPasswordResetDto,
    @Req() req: Request,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const result = await this.passwordResetService.requestReset(
      payload,
      lang,
      getClientIp(req),
    );

    return this.responseService.success({
      message: this.i18n.t('message.success.passwordResetRequested', { lang }),
      data: result,
    });
  }

  @ApiOperation({ summary: 'Verify password reset OTP' })
  @ApiResponse({ status: 200, description: 'OTP verified; reset token issued' })
  @HttpCode(HttpStatus.OK)
  @Post('verify')
  async verifyOtp(@Body() payload: VerifyPasswordResetOtpDto) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const result = await this.passwordResetService.verifyOtp(payload, lang);

    return this.responseService.success({
      message: this.i18n.t('message.success.passwordResetOtpVerified', { lang }),
      data: result,
    });
  }

  @ApiOperation({ summary: 'Confirm new password' })
  @ApiResponse({ status: 200, description: 'Password updated' })
  @HttpCode(HttpStatus.OK)
  @Post('confirm')
  async confirmReset(@Body() payload: ConfirmPasswordResetDto) {
    const lang = I18nContext.current()?.lang ?? 'en';
    await this.passwordResetService.confirmReset(payload, lang);

    return this.responseService.success({
      message: this.i18n.t('message.success.passwordResetCompleted', { lang }),
      data: null,
    });
  }
}
