import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { PullResponse } from '@subrent/shared';
import { startServer, type TestServer } from './harness';

let server: TestServer;
let token: string;

beforeAll(async () => {
  server = await startServer();
  await server.addUser('Fantasy', 'fantasy@example.com', 'correct horse battery');
  const login = await server.app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'fantasy@example.com', password: 'correct horse battery' }),
  });
  token = ((await login.json()) as { token: string }).token;
});

afterAll(async () => {
  await server.close();
});

const headers = () => ({ 'content-type': 'application/json', authorization: `Bearer ${token}` });

describe('concurrent writers and a pulling reader', () => {
  it('a reader that keeps pulling with its cursor never misses a row', async () => {
    const WRITERS = 8;
    const ROWS_PER_PUSH = 5;
    const PUSHES_PER_WRITER = 6;
    const expected = new Set<string>();

    // The reader pulls in a tight loop while writers run, advancing its cursor
    // exactly as a real device does.
    const seen = new Set<string>();
    let cursor = 0;
    let writing = true;
    const pullOnce = async () => {
      const response = await server.app.request(`/api/sync/pull?since=${cursor}&limit=7`, { headers: headers() });
      const page = (await response.json()) as PullResponse;
      for (const { row } of page.rows) seen.add(row.id);
      cursor = page.cursor;
      return page;
    };
    const reader = (async () => {
      while (writing) await pullOnce();
    })();

    const writer = async () => {
      for (let p = 0; p < PUSHES_PER_WRITER; p++) {
        const changes = Array.from({ length: ROWS_PER_PUSH }, () => {
          const id = randomUUID();
          expected.add(id);
          return { table: 'landlords', id, op: 'upsert', patch: { name: `L-${id.slice(0, 6)}` } };
        });
        const response = await server.app.request('/api/sync/push', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ changes }),
        });
        const { results } = (await response.json()) as { results: { status: string }[] };
        expect(results.every((r) => r.status === 'ok')).toBe(true);
      }
    };

    await Promise.all(Array.from({ length: WRITERS }, writer));
    writing = false;
    await reader;

    // Drain whatever landed after the reader's last loop.
    let page = await pullOnce();
    while (page.hasMore) page = await pullOnce();

    expect(expected.size).toBe(WRITERS * PUSHES_PER_WRITER * ROWS_PER_PUSH);
    const missing = [...expected].filter((id) => !seen.has(id));
    expect(missing).toEqual([]);
  });
});
