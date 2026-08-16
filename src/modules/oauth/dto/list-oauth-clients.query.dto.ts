import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { OAuthClientStatusEnum } from '@/_db/drizzle/enum';

export const listOAuthClientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([OAuthClientStatusEnum.ACTIVE, OAuthClientStatusEnum.DISABLED])
    .optional(),
});

export class ListOAuthClientsQueryDto extends createZodDto(
  listOAuthClientsQuerySchema,
) {}

export type ListOAuthClientsQuery = z.infer<typeof listOAuthClientsQuerySchema>;
