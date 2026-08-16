export interface PaginatedSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  timestamp: string;
}
