import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { createApp } from './app';
import { createDb } from './db';
import { loadEnv } from './env';
import { createFileSigner } from './files';

const env = loadEnv();
const handle = await createDb({ url: env.databaseUrl, dataDir: env.databaseUrl ? undefined : env.devDataDir });
const files = env.r2 ? createFileSigner(env.r2) : null;
const api = createApp({ db: handle.db, env, files });

const root = new Hono();
root.route('/', api);

// In production one container serves both the API and the built web app.
const webDist = env.webDist ? resolve(env.webDist) : undefined;
if (webDist && !existsSync(resolve(webDist, 'index.html'))) {
  // A wrong path should stop the server, not quietly serve an API with no app.
  throw new Error(`WEB_DIST is set to ${webDist}, but there is no index.html there. Run the web build first.`);
}
if (webDist) {
  root.use('/*', serveStatic({ root: webDist }));
  // Any other path is an app route: hand back the shell so the router can take over.
  const indexHtml = await readFile(resolve(webDist, 'index.html'), 'utf8');
  root.get('*', (c) => (c.req.path.startsWith('/api/') ? c.notFound() : c.html(indexHtml)));
}

serve({ fetch: root.fetch, port: env.port }, (info) => {
  console.log(`API listening on http://localhost:${info.port} (database: ${handle.kind})`);
  if (!env.r2) console.log('File storage not configured (set R2_* variables to enable uploads).');
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void handle.close().finally(() => process.exit(0));
  });
}
