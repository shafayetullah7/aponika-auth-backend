import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PlatformAdminAuthGuard } from '@/libs/guards/platform-admin-auth.guard';

@ApiTags('Admin Clients')
@Controller({ path: 'admin/clients', version: '1' })
@UseGuards(PlatformAdminAuthGuard)
export class AdminClientsController {
  @ApiOperation({
    summary: 'List OAuth clients (stub)',
    description: 'Placeholder route to verify admin auth guard. Implemented in F7.',
  })
  @ApiResponse({ status: 200, description: 'Guard passed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  listStub() {
    return {
      success: true,
      message: 'Admin clients API not implemented yet',
      data: [],
    };
  }
}
