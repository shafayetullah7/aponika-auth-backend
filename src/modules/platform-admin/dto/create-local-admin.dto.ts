import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { passwordSchema } from '@/libs/validation/password.schema';

export const createLocalAdminSchema = z.object({
  firstName: z
    .string()
    .min(1, { message: 'First name cannot be empty' })
    .max(50, { message: 'First name cannot exceed 50 characters' })
    .regex(/^[a-zA-Z]+$/, { message: 'First name can only contain letters' }),

  lastName: z
    .string()
    .min(1, { message: 'Last name cannot be empty' })
    .max(50, { message: 'Last name cannot exceed 50 characters' })
    .regex(/^[a-zA-Z]+$/, { message: 'Last name can only contain letters' }),

  userName: z
    .string()
    .min(3, { message: 'Username must be at least 3 characters' })
    .max(50, { message: 'Username cannot exceed 50 characters' })
    .regex(/^[a-z0-9_]+$/, {
      message:
        'Username can only contain lowercase letters, numbers, and underscores',
    }),

  email: z
    .email({ message: 'Invalid email format' })
    .max(255, { message: 'Email cannot exceed 255 characters' }),

  password: passwordSchema,
});

export class CreateLocalAdminDto extends createZodDto(createLocalAdminSchema) {}

export type CreateLocalAdminInput = z.infer<typeof createLocalAdminSchema>;
