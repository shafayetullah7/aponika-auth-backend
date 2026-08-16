import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const listAdminUserSessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export class ListAdminUserSessionsQueryDto extends createZodDto(
  listAdminUserSessionsQuerySchema,
) {}

export type ListAdminUserSessionsQuery = z.infer<
  typeof listAdminUserSessionsQuerySchema
>;
