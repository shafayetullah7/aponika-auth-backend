import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { UserStatusEnum } from '@/_db/drizzle/enum';

export const listAdminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).optional(),
  status: z
    .enum([UserStatusEnum.ACTIVE, UserStatusEnum.SUSPENDED])
    .optional(),
});

export class ListAdminUsersQueryDto extends createZodDto(
  listAdminUsersQuerySchema,
) {}

export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;
