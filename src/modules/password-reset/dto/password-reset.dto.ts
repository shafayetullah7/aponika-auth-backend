import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { passwordSchema } from '@/libs/validation/password.schema';

export const requestPasswordResetSchema = z.object({
  email: z.string().email({ message: 'Valid email is required' }),
});

export const verifyPasswordResetOtpSchema = z.object({
  token: z.string().min(1, { message: 'Token is required' }),
  otp: z
    .string()
    .length(6, { message: 'OTP must be 6 digits' })
    .regex(/^\d+$/, { message: 'OTP must contain only numbers' }),
});

export const confirmPasswordResetSchema = z.object({
  token: z.string().min(1, { message: 'Token is required' }),
  password: passwordSchema,
});

export class RequestPasswordResetDto extends createZodDto(
  requestPasswordResetSchema,
) {}

export class VerifyPasswordResetOtpDto extends createZodDto(
  verifyPasswordResetOtpSchema,
) {}

export class ConfirmPasswordResetDto extends createZodDto(
  confirmPasswordResetSchema,
) {}

export type RequestPasswordResetInput = z.infer<
  typeof requestPasswordResetSchema
>;
export type VerifyPasswordResetOtpInput = z.infer<
  typeof verifyPasswordResetOtpSchema
>;
export type ConfirmPasswordResetInput = z.infer<
  typeof confirmPasswordResetSchema
>;
