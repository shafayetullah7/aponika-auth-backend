import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const resendVerificationSchema = z.object({
  email: z
    .email({ message: 'Invalid email format' })
    .max(255, { message: 'Email cannot exceed 255 characters' }),
});

export class ResendVerificationDto extends createZodDto(resendVerificationSchema) {}

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
