import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { createLocalAdminSchema } from './create-local-admin.dto';

export const completeLocalAdminSchema = createLocalAdminSchema.extend({
  otp: z
    .string()
    .length(6, { message: 'OTP must be 6 digits' })
    .regex(/^\d+$/, { message: 'OTP must contain only digits' }),
});

export class CompleteLocalAdminDto extends createZodDto(
  completeLocalAdminSchema,
) {}

export type CompleteLocalAdminInput = z.infer<typeof completeLocalAdminSchema>;
