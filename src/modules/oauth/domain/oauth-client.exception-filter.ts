import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorCode } from '@/libs/response/error.schema';
import {
  OAuthClientConflictError,
  OAuthClientNotFoundError,
  OAuthClientValidationError,
} from './oauth-client.errors';

@Catch(
  OAuthClientNotFoundError,
  OAuthClientConflictError,
  OAuthClientValidationError,
)
export class OAuthClientExceptionFilter implements ExceptionFilter {
  catch(
    exception:
      | OAuthClientNotFoundError
      | OAuthClientConflictError
      | OAuthClientValidationError,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof OAuthClientNotFoundError) {
      response.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: exception.message,
        error: { code: ErrorCode.NOT_FOUND },
        statusCode: HttpStatus.NOT_FOUND,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (exception instanceof OAuthClientConflictError) {
      response.status(HttpStatus.CONFLICT).json({
        success: false,
        message: exception.message,
        error: { code: ErrorCode.DUPLICATE_ENTRY },
        statusCode: HttpStatus.CONFLICT,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    response.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      message: exception.message,
      error: { code: ErrorCode.VALIDATION_ERROR },
      statusCode: HttpStatus.BAD_REQUEST,
      timestamp: new Date().toISOString(),
    });
  }
}
