import { createZodDto } from 'nestjs-zod';
import {
  createOAuthClientSchema,
  updateOAuthClientSchema,
} from './oauth-client.schema';

export class CreateOAuthClientDto extends createZodDto(createOAuthClientSchema) {}

export class UpdateOAuthClientDto extends createZodDto(updateOAuthClientSchema) {}
