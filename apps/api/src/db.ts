import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { migrate as migrateNodePg } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import pg from 'pg';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;

export interface DbHandle {
  db: Db;
  kind: 'postgres' | 'embedded';
  close: () => Promise<void>;
}

// Resolved from the file's own location. (Avoids the global URL class, which test
// environments such as jsdom replace with their own.)
const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle');

/**
 * - `url` set: real PostgreSQL (production).
 * - `dataDir` set: embedded Postgres persisted to disk (local development).
 * - neither: embedded Postgres in memory (tests).
 */
export async function createDb(options: { url?: string; dataDir?: string }): Promise<DbHandle> {
  if (options.url) {
    const pool = new pg.Pool({ connectionString: options.url });
    const db = drizzleNodePg(pool, { schema });
    await migrateNodePg(db, { migrationsFolder });
    return { db, kind: 'postgres', close: () => pool.end() };
  }

  const client = new PGlite(options.dataDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  return { db, kind: 'embedded', close: () => client.close() };
}
