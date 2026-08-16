import { config as loadEnv } from 'dotenv';
import * as path from 'path';
import { envSchema } from './env.schema';

loadEnv({
  path: path.resolve(
    process.cwd(),
    `.env.${process.env.NODE_ENV || 'development'}`,
  ),
});

export default () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment:', parsed.error.format());
    process.exit(1);
  }

  return parsed.data;
};
