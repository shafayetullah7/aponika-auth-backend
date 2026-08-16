import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OidcAccessToken } from '@/libs/decorators/oidc-access-token.decorator';
import { JwtResourceGuard } from '@/libs/auth/jwt-resource.guard';
import { OidcAccessTokenContext } from '@/libs/types/oidc-access-token.type';
import { ResponseService } from '@/libs/response/response.service';

@ApiTags('Example (resource server)')
@Controller({ path: 'example', version: '1' })
export class ExampleController {
  constructor(private readonly responseService: ResponseService) {}

  @ApiOperation({
    summary: 'Protected example route',
    description:
      'Reference resource-server endpoint. Requires a valid OIDC access token (Bearer JWT).',
  })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Token accepted' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @UseGuards(JwtResourceGuard)
  @Get('protected')
  getProtected(@OidcAccessToken() token: OidcAccessTokenContext) {
    return this.responseService.success({
      message: 'Access token accepted',
      data: {
        sub: token.sub,
        email: token.email ?? null,
        email_verified: token.email_verified ?? null,
      },
    });
  }
}
