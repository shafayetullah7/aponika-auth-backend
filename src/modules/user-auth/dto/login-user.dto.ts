import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const loginUserSchema = z.object({
  email: z
    .email({ message: 'Invalid email format' })
    .max(255, { message: 'Email cannot exceed 255 characters' }),

  password: z
    .string()
    .min(1, { message: 'Password is required' })
    .max(255, { message: 'Password cannot exceed 255 characters' }),
});

export class LoginUserDto extends createZodDto(loginUserSchema) {}

export type LoginUserInput = z.infer<typeof loginUserSchema>;
