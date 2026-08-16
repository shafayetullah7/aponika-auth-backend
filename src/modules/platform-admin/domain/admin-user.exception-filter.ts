import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorCode } from '@/libs/response/error.schema';
import { AdminUserNotFoundError } from './admin-user.errors';

@Catch(AdminUserNotFoundError)
export class AdminUserExceptionFilter implements ExceptionFilter {
  catch(exception: AdminUserNotFoundError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(HttpStatus.NOT_FOUND).json({
      success: false,
      message: exception.message,
      error: { code: ErrorCode.NOT_FOUND },
      statusCode: HttpStatus.NOT_FOUND,
      timestamp: new Date().toISOString(),
    });
  }
}
