import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { passwordSchema } from '@/libs/validation/password.schema';

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, { message: 'Current password is required' })
    .max(255, { message: 'Current password cannot exceed 255 characters' }),

  newPassword: passwordSchema,
});

export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
