import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { eq, sql } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { sign, verify } from 'hono/jwt';
import type { LoginResponse, UserRole } from '@subrent/shared';
import type { Db } from './db';
import { users } from './schema';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
/** Long-lived on purpose: the app must open offline for days between logins. */
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Hash of a throwaway password, compared against when the email is unknown so
// a missing account takes as long to reject as a wrong password.
const dummyHashPromise = hashPassword('not-a-real-password');

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type AuthVariables = { user: AuthUser };

export async function issueToken(user: AuthUser, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    { sub: user.id, name: user.name, email: user.email, role: user.role, iat: now, exp: now + TOKEN_TTL_SECONDS },
    secret,
    'HS256',
  );
}

export function requireAuth(secret: string): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return c.json({ error: 'unauthorized' }, 401);
    try {
      const payload = await verify(token, secret, 'HS256');
      const role = payload.role === 'staff' ? 'staff' : 'owner';
      c.set('user', {
        id: String(payload.sub),
        name: String(payload.name ?? ''),
        email: String(payload.email ?? ''),
        role,
      });
    } catch {
      return c.json({ error: 'unauthorized' }, 401);
    }
    await next();
  };
}

const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

/** In-memory limiter: 10 failed logins per email per 15 minutes. */
export class LoginLimiter {
  private failures = new Map<string, { count: number; resetAt: number }>();

  isBlocked(email: string, now = Date.now()): boolean {
    const entry = this.failures.get(email);
    if (!entry) return false;
    if (entry.resetAt <= now) {
      this.failures.delete(email);
      return false;
    }
    return entry.count >= MAX_FAILURES;
  }

  recordFailure(email: string, now = Date.now()): void {
    const entry = this.failures.get(email);
    if (!entry || entry.resetAt <= now) {
      this.failures.set(email, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      entry.count += 1;
    }
  }

  reset(email: string): void {
    this.failures.delete(email);
  }
}

export async function login(
  db: Db,
  secret: string,
  email: string,
  password: string,
): Promise<LoginResponse | null> {
  const normalized = email.trim().toLowerCase();
  const [row] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${normalized} and ${users.deletedAt} is null`)
    .limit(1);

  const ok = await verifyPassword(password, row?.passwordHash ?? (await dummyHashPromise));
  if (!row || !ok) return null;

  const user: AuthUser = { id: row.id, name: row.name, email: row.email, role: row.role };
  return { token: await issueToken(user, secret), user };
}

export async function userExists(db: Db, id: string): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  return Boolean(row);
}
