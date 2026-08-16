import { z } from 'zod';

/**
 * Shared password policy for platform admin and end-user registration.
 * Validation messages are returned in API error responses (ZodValidationPipe).
 */
export const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters' })
  .max(255, { message: 'Password cannot exceed 255 characters' })
  .regex(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  .regex(/[a-z]/, {
    message: 'Password must contain at least one lowercase letter',
  })
  .regex(/[0-9]/, { message: 'Password must contain at least one number' })
  .regex(/[^A-Za-z0-9]/, {
    message: 'Password must contain at least one special character',
  });

export type PasswordInput = z.infer<typeof passwordSchema>;
