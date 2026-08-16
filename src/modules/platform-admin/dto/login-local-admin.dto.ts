import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const loginLocalAdminSchema = z.object({
  email: z
    .email({ message: 'Invalid email format' })
    .min(1, { message: 'Email is required' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

export class LoginLocalAdminDto extends createZodDto(loginLocalAdminSchema) {}

export type LoginLocalAdminInput = z.infer<typeof loginLocalAdminSchema>;
