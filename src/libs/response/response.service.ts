import { Injectable } from '@nestjs/common';
import { PaginatedSuccessResponse } from './paginated.response';

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

  paginated<T>(payload: {
    message: string;
    data: T;
    meta: { page: number; limit: number; total: number };
  }): PaginatedSuccessResponse<T> {
    const { page, limit, total } = payload.meta;

    return {
      success: true,
      message: payload.message,
      data: payload.data,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 0,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
