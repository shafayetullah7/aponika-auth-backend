import { z } from 'zod';
import { OAuthClientTypeEnum } from '@/_db/drizzle/enum';
import { validateUriBundle } from '../domain/oauth-client-uri.validation';

const clientIdSchema = z
  .string()
  .min(3)
  .max(128)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'clientId must be lowercase alphanumeric segments separated by hyphens',
  );

const uriBundleFields = {
  redirectUris: z.array(z.string().min(1)).min(1),
  postLogoutRedirectUris: z.array(z.string().min(1)).optional(),
  allowedOrigins: z.array(z.string().min(1)).optional(),
};

function addUriBundleIssues(
  data: {
    redirectUris: string[];
    postLogoutRedirectUris?: string[];
    allowedOrigins?: string[];
  },
  ctx: z.RefinementCtx,
) {
  try {
    validateUriBundle(data);
  } catch (error) {
    ctx.addIssue({
      code: 'custom',
      message:
        error instanceof Error ? error.message : 'Invalid OAuth client URIs',
      path: ['redirectUris'],
    });
  }
}

function addPublicClientPkceIssue(
  data: {
    clientType: (typeof OAuthClientTypeEnum)[keyof typeof OAuthClientTypeEnum];
    pkceRequired?: boolean;
  },
  ctx: z.RefinementCtx,
) {
  if (
    data.clientType === OAuthClientTypeEnum.PUBLIC &&
    data.pkceRequired === false
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Public clients must require PKCE',
      path: ['pkceRequired'],
    });
  }
}

export const createOAuthClientSchema = z
  .object({
    clientId: clientIdSchema,
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    clientType: z.enum([
      OAuthClientTypeEnum.PUBLIC,
      OAuthClientTypeEnum.CONFIDENTIAL,
    ]),
    ...uriBundleFields,
    grantTypes: z.array(z.string().min(1)).min(1).optional(),
    responseTypes: z.array(z.string().min(1)).min(1).optional(),
    scopes: z.array(z.string().min(1)).min(1).optional(),
    pkceRequired: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    addPublicClientPkceIssue(data, ctx);
    addUriBundleIssues(data, ctx);
  });

export type TCreateOAuthClientInput = z.infer<typeof createOAuthClientSchema>;

export const updateOAuthClientSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
    redirectUris: z.array(z.string().min(1)).min(1).optional(),
    postLogoutRedirectUris: z.array(z.string().min(1)).optional(),
    allowedOrigins: z.array(z.string().min(1)).optional(),
    grantTypes: z.array(z.string().min(1)).min(1).optional(),
    responseTypes: z.array(z.string().min(1)).min(1).optional(),
    scopes: z.array(z.string().min(1)).min(1).optional(),
    pkceRequired: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field is required',
  });

export type TUpdateOAuthClientInput = z.infer<typeof updateOAuthClientSchema>;
