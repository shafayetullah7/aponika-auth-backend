import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/_db/drizzle/schema';

const env = process.env.NODE_ENV || 'development';
dotenv.config({ path: `.env.${env}` });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true',
});

export const seedDb = drizzle(pool, { schema });

export async function closeSeedDb(): Promise<void> {
  await pool.end();
}
