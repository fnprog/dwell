import { randomUUID } from 'node:crypto';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import pg from 'pg';
import { LocalDb, SyncEngine } from '@subrent/sync-client';
import { createApp } from '../src/app';
import { hashPassword } from '../src/auth';
import { createDb, type DbHandle } from '../src/db';
import { users } from '../src/schema';
import { withWriteLock } from '../src/sync';

export const TEST_SECRET = 'test-secret-test-secret-test-secret-1234';

export interface TestServer {
  handle: DbHandle;
  app: ReturnType<typeof createApp>;
  addUser(name: string, email: string, password: string, role?: 'owner' | 'staff'): Promise<string>;
  close(): Promise<void>;
}

/**
 * A real API with all migrations applied.
 *
 * By default it runs on an in-memory embedded Postgres. Set TEST_DATABASE_URL to
 * a real PostgreSQL server (any database on it) and each test server gets its
 * own fresh database there instead, exercising the production driver.
 */
export async function startServer(): Promise<TestServer> {
  const adminUrl = process.env['TEST_DATABASE_URL'];
  let dropDatabase: (() => Promise<void>) | null = null;
  let url: string | undefined;

  if (adminUrl) {
    const name = `test_${randomUUID().replace(/-/g, '')}`;
    const admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create database ${name}`);
    await admin.end();
    const target = new URL(adminUrl);
    target.pathname = `/${name}`;
    url = target.toString();
    dropDatabase = async () => {
      const cleanup = new pg.Client({ connectionString: adminUrl });
      await cleanup.connect();
      await cleanup.query(`drop database if exists ${name} with (force)`);
      await cleanup.end();
    };
  }

  const handle = await createDb({ url });
  const app = createApp({
    db: handle.db,
    env: { jwtSecret: TEST_SECRET, corsOrigin: undefined },
    files: null,
  });
  return {
    handle,
    app,
    async addUser(name, email, password, role = 'owner') {
      const id = randomUUID();
      const passwordHash = await hashPassword(password);
      await withWriteLock(handle.db, async (tx) => {
        await tx.insert(users).values({ id, name, email, role, passwordHash });
      });
      return id;
    },
    async close() {
      await handle.close();
      await dropDatabase?.();
    },
  };
}

export interface TestDevice {
  engine: SyncEngine;
  db: LocalDb;
  setOnline(online: boolean): void;
}

let deviceCounter = 0;

/** A device = its own on-device database + sync engine, talking to the server in-process. */
export function newDevice(server: TestServer): TestDevice {
  let online = true;
  const db = new LocalDb(`device-${++deviceCounter}-${randomUUID()}`, { indexedDB, IDBKeyRange });
  const fetchImpl: typeof fetch = async (input, init) => {
    if (!online) throw new TypeError('fetch failed');
    return server.app.request(String(input), init);
  };
  return {
    db,
    engine: new SyncEngine(db, { baseUrl: '', fetchImpl }),
    setOnline(value) {
      online = value;
    },
  };
}
