import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Name cannot be empty' })
    .max(255, { message: 'Name cannot exceed 255 characters' }),
});

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
