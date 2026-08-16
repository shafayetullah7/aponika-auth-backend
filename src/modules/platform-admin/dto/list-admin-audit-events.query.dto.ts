import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const listAdminAuditEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().trim().min(1).optional(),
  actor: z.string().uuid().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

export class ListAdminAuditEventsQueryDto extends createZodDto(
  listAdminAuditEventsQuerySchema,
) {}

export type ListAdminAuditEventsQuery = z.infer<
  typeof listAdminAuditEventsQuerySchema
>;
