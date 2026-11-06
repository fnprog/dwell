/**
 * Create an owner account:
 *   npm run user:create -w @subrent/api -- "Fantasy" fantasy@example.com 'a long password'
 * Uses DATABASE_URL when set, otherwise the embedded dev database.
 */
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/auth';
import { createDb } from '../src/db';
import { loadEnv } from '../src/env';
import { users } from '../src/schema';
import { withWriteLock } from '../src/sync';

const [name, email, password, role = 'owner'] = process.argv.slice(2);

if (!name || !email || !password) {
  console.error('Usage: create-user <name> <email> <password> [owner|staff]');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Password must be at least 10 characters.');
  process.exit(1);
}
if (role !== 'owner' && role !== 'staff') {
  console.error('Role must be owner or staff.');
  process.exit(1);
}

const env = loadEnv();
const handle = await createDb({ url: env.databaseUrl, dataDir: env.databaseUrl ? undefined : env.devDataDir });

try {
  await withWriteLock(handle.db, async (tx) => {
    await tx.insert(users).values({
      id: randomUUID(),
      name,
      email: email.trim().toLowerCase(),
      role,
      passwordHash: await hashPassword(password),
    });
  });
  console.log(`Created ${role} account for ${email}`);
} finally {
  await handle.close();
}
