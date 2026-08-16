import { Injectable } from '@nestjs/common';

export interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class ResponseService {
  success<T>(payload: { message: string; data: T }): SuccessResponse<T> {
    return {
      success: true,
      message: payload.message,
      data: payload.data,
      timestamp: new Date().toISOString(),
    };
  }
}
