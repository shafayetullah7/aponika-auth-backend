import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { passwordSchema } from '@/libs/validation/password.schema';

export const registerUserSchema = z.object({
  email: z
    .email({ message: 'Invalid email format' })
    .max(255, { message: 'Email cannot exceed 255 characters' }),

  password: passwordSchema,

  name: z
    .string()
    .min(1, { message: 'Name cannot be empty' })
    .max(255, { message: 'Name cannot exceed 255 characters' }),
});

export class RegisterUserDto extends createZodDto(registerUserSchema) {}

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
