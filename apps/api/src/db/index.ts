import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { env } from '../lib/env.js';

let _db: PostgresJsDatabase<typeof schema> | null = null;

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    if (!_db) {
      const client = postgres(env().DATABASE_URL);
      _db = drizzle(client, { schema });
    }
    return Reflect.get(_db, prop, receiver);
  },
});
