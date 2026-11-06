import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createFileSigner, isValidKey, makeKey } from '../src/files';
import { startServer, TEST_SECRET, type TestServer } from './harness';

let server: TestServer;
let token: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  server = await startServer();
  await server.addUser('Fantasy', 'fantasy@example.com', 'correct horse battery');
  const login = await server.app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'fantasy@example.com', password: 'correct horse battery' }),
  });
  token = ((await login.json()) as { token: string }).token;
  // Signing URLs is a local computation, so fake credentials are enough to test the routes.
  const files = createFileSigner({
    accountId: 'acct123',
    accessKeyId: 'AKIAFAKE',
    secretAccessKey: 'fakesecret',
    bucket: 'subrent-test',
  });
  app = createApp({ db: server.handle.db, env: { jwtSecret: TEST_SECRET, corsOrigin: undefined }, files });
});

afterAll(async () => {
  await server.close();
});

const post = (body: unknown, auth = true) =>
  app.request('/api/files/sign', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

describe('file signing', () => {
  it('requires sign-in', async () => {
    expect((await post({ action: 'put', fileName: 'a.pdf', contentType: 'application/pdf' }, false)).status).toBe(401);
  });

  it('issues a short-lived upload URL on R2 with a server-chosen key', async () => {
    const response = await post({ action: 'put', fileName: 'Lease Agreement (final).pdf', contentType: 'application/pdf' });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { key: string; url: string; expiresIn: number };
    expect(body.key).toMatch(/^uploads\/[0-9a-f-]{36}\/Lease-Agreement-final-.pdf$/);
    expect(isValidKey(body.key)).toBe(true);
    const url = new URL(body.url);
    expect(url.hostname).toBe('subrent-test.acct123.r2.cloudflarestorage.com');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
  });

  it('refuses file types that are not contracts, receipts or photos', async () => {
    const response = await post({ action: 'put', fileName: 'run.exe', contentType: 'application/x-msdownload' });
    expect(response.status).toBe(400);
  });

  it('only signs downloads for keys inside uploads/', async () => {
    const good = makeKey('receipt.jpg');
    expect((await post({ action: 'get', key: good })).status).toBe(200);
    expect((await post({ action: 'get', key: '../secrets/db.sql' })).status).toBe(400);
    expect((await post({ action: 'get', key: 'uploads/../../etc/passwd' })).status).toBe(400);
    expect((await post({ action: 'get', key: 'other-bucket-path/file.pdf' })).status).toBe(400);
  });

  it('reports 503 when file storage is not configured', async () => {
    const response = await server.app.request('/api/files/sign', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'put', fileName: 'a.pdf', contentType: 'application/pdf' }),
    });
    expect(response.status).toBe(503);
  });
});
