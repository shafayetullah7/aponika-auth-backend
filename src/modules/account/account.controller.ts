import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { CurrentUser } from '@/libs/decorators/current-user.decorator';
import { UserAuthGuard } from '@/libs/guards/user-auth.guard';
import { ResponseService } from '@/libs/response/response.service';
import { AuthenticatedUser } from '@/libs/types/authenticated-user.type';
import { UserAuthService } from '@/modules/user-auth/user-auth.service';
import { AccountService } from './account.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Account')
@UseGuards(UserAuthGuard)
@Controller({ path: 'account', version: '1' })
export class AccountController {
  constructor(
    private readonly userAuthService: UserAuthService,
    private readonly accountService: AccountService,
    private readonly i18n: I18nService,
    private readonly responseService: ResponseService,
  ) {}

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Authenticated user' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @Get('me')
  getMe(@CurrentUser() auth: AuthenticatedUser) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const user = this.userAuthService.getCurrentUser(auth);

    return this.responseService.success({
      message: this.i18n.t('message.success.userAuthenticated', { lang }),
      data: user,
    });
  }

  @ApiOperation({ summary: 'Update display name' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @Patch('profile')
  async updateProfile(
    @CurrentUser() auth: AuthenticatedUser,
    @Body() payload: UpdateProfileDto,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    const user = await this.accountService.updateProfile(auth, payload, lang);

    return this.responseService.success({
      message: this.i18n.t('message.success.userProfileUpdated', { lang }),
      data: user,
    });
  }

  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 200, description: 'Password changed' })
  @ApiResponse({ status: 401, description: 'Invalid current password' })
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(
    @CurrentUser() auth: AuthenticatedUser,
    @Body() payload: ChangePasswordDto,
  ) {
    const lang = I18nContext.current()?.lang ?? 'en';
    await this.accountService.changePassword(auth, payload, lang);

    return this.responseService.success({
      message: this.i18n.t('message.success.userPasswordChanged', { lang }),
      data: null,
    });
  }
}
