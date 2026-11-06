import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { PushChange, PushResponse } from '@subrent/shared';
import { LoginLimiter, login, requireAuth, type AuthVariables } from './auth';
import type { Db } from './db';
import type { Env } from './env';
import { ALLOWED_CONTENT_TYPES, isValidKey, type FileSigner } from './files';
import { applyPush, pullChanges } from './sync';

const MAX_PUSH_CHANGES = 200;
const DEFAULT_PULL_LIMIT = 500;
const MAX_PULL_LIMIT = 1000;

export interface AppDeps {
  db: Db;
  env: Pick<Env, 'jwtSecret' | 'corsOrigin'>;
  files: FileSigner | null;
}

export function createApp({ db, env, files }: AppDeps) {
  const app = new Hono<{ Variables: AuthVariables }>();
  const limiter = new LoginLimiter();
  const auth = requireAuth(env.jwtSecret);

  app.use('*', secureHeaders());
  if (env.corsOrigin) {
    app.use('/api/*', cors({ origin: env.corsOrigin, allowHeaders: ['authorization', 'content-type'] }));
  }

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.post('/api/auth/login', async (c) => {
    const body = await c.req.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email || !password) return c.json({ error: 'email and password are required' }, 400);
    if (limiter.isBlocked(email)) return c.json({ error: 'too many attempts, try again later' }, 429);

    const result = await login(db, env.jwtSecret, email, password);
    if (!result) {
      limiter.recordFailure(email);
      return c.json({ error: 'wrong email or password' }, 401);
    }
    limiter.reset(email);
    return c.json(result);
  });

  app.get('/api/auth/me', auth, (c) => c.json({ user: c.get('user') }));

  app.post('/api/sync/push', auth, async (c) => {
    const user = c.get('user');
    if (user.role !== 'owner') return c.json({ error: 'forbidden' }, 403);

    const body = await c.req.json().catch(() => null);
    const changes = body?.changes as PushChange[] | undefined;
    if (!Array.isArray(changes)) return c.json({ error: 'changes must be an array' }, 400);
    if (changes.length > MAX_PUSH_CHANGES) {
      return c.json({ error: `at most ${MAX_PUSH_CHANGES} changes per push` }, 413);
    }

    const results = await applyPush(db, user.id, changes);
    const response: PushResponse = { results };
    return c.json(response);
  });

  app.get('/api/sync/pull', auth, async (c) => {
    const user = c.get('user');
    if (user.role !== 'owner') return c.json({ error: 'forbidden' }, 403);

    const since = Number(c.req.query('since') ?? 0);
    const limit = Number(c.req.query('limit') ?? DEFAULT_PULL_LIMIT);
    if (!Number.isSafeInteger(since) || since < 0) return c.json({ error: 'invalid since' }, 400);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PULL_LIMIT) {
      return c.json({ error: `limit must be 1 to ${MAX_PULL_LIMIT}` }, 400);
    }
    return c.json(await pullChanges(db, since, limit));
  });

  app.post('/api/files/sign', auth, async (c) => {
    if (!files) return c.json({ error: 'file storage is not configured' }, 503);
    const body = await c.req.json().catch(() => null);

    if (body?.action === 'put') {
      const fileName = typeof body.fileName === 'string' ? body.fileName : '';
      const contentType = typeof body.contentType === 'string' ? body.contentType : '';
      if (!fileName) return c.json({ error: 'fileName is required' }, 400);
      if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)) {
        return c.json({ error: `contentType must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}` }, 400);
      }
      return c.json(await files.signUpload(fileName, contentType));
    }

    if (body?.action === 'get') {
      const key = typeof body.key === 'string' ? body.key : '';
      if (!isValidKey(key)) return c.json({ error: 'invalid key' }, 400);
      return c.json(await files.signDownload(key));
    }

    return c.json({ error: 'action must be put or get' }, 400);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
