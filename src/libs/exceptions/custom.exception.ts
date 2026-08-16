import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@/libs/response/error.schema';

export class CustomException extends HttpException {
  public readonly statusCode: HttpStatus;
  public readonly errorCode?: ErrorCode;

  constructor({
    message,
    statusCode,
    errorCode,
  }: {
    message: string;
    statusCode: HttpStatus;
    errorCode?: ErrorCode;
  }) {
    super({ message, statusCode, errorCode }, statusCode);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}
