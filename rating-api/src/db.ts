import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createClient } from 'redis';
import * as schema from './schema';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

export const redis = createClient({ url: process.env.REDIS_URL });
if (process.env.NODE_ENV !== 'test') {
  redis.connect().catch((err) => console.error('Redis connect error', err));
}
