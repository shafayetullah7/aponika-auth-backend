import { z } from 'zod';

export const submitOidcConsentSchema = z.object({
  remember: z.boolean().default(false),
});

export type TSubmitOidcConsentInput = z.infer<typeof submitOidcConsentSchema>;
