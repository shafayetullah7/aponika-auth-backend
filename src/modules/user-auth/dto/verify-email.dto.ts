import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const verifyEmailSchema = z.object({
  token: z
    .string()
    .min(1, { message: 'Verification token is required' })
    .max(512, { message: 'Verification token is invalid' }),
});

export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
