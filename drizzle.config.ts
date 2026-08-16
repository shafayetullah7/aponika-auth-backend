import * as dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

const env = process.env.NODE_ENV || 'development';

dotenv.config({ path: `.env.${env}` });

export default defineConfig({
  schema: './src/_db/drizzle/schema',
  out: './src/_db/drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT!, 10),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    ssl: process.env.DB_SSL === 'true',
  },
  verbose: true,
  strict: true,
  migrations: {
    table: 'drizzle_migrations',
  },
});
