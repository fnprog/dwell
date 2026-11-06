import { eq, getTableColumns, gt, sql } from 'drizzle-orm';
import type { AnyPgColumn, AnyPgTable } from 'drizzle-orm/pg-core';
import {
  ENTITY_NAMES,
  IMMUTABLE_ENTITIES,
  READ_ONLY_ENTITIES,
  SERVER_CONTROLLED_FIELDS,
  isEntityName,
  type PullResponse,
  type PullRow,
  type PushChange,
  type PushResult,
} from '@subrent/shared';
import type { Db } from './db';
import { tables, users } from './schema';

type Column = AnyPgColumn & { enumValues?: readonly string[] };

/** Thrown inside a change to reject just that change and roll back its savepoint. */
class Rejection extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SERVER_FIELDS = new Set<string>(SERVER_CONTROLLED_FIELDS);

/** Pushes are serialized with this lock so sequence order equals commit order. */
const WRITE_LOCK_KEY = 4_217_001;

export async function withWriteLock<T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${WRITE_LOCK_KEY})`);
    return fn(tx as unknown as Db);
  });
}

function checkValue(field: string, column: Column, value: unknown): void {
  if (value === null) {
    if (column.notNull) throw new Rejection(`${field} cannot be empty`);
    return;
  }
  switch (column.columnType) {
    case 'PgUUID':
      if (typeof value !== 'string' || !UUID.test(value)) throw new Rejection(`${field} must be a UUID`);
      return;
    case 'PgText':
      if (typeof value !== 'string') throw new Rejection(`${field} must be text`);
      if (column.enumValues && !column.enumValues.includes(value)) {
        throw new Rejection(`${field} must be one of: ${column.enumValues.join(', ')}`);
      }
      return;
    case 'PgBigInt53':
    case 'PgInteger':
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
        throw new Rejection(`${field} must be a whole number`);
      }
      return;
    case 'PgDoublePrecision':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Rejection(`${field} must be a number`);
      }
      return;
    case 'PgDateString':
      if (typeof value !== 'string' || !DATE.test(value) || Number.isNaN(Date.parse(value))) {
        throw new Rejection(`${field} must be a date (YYYY-MM-DD)`);
      }
      return;
    case 'PgTimestampString':
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        throw new Rejection(`${field} must be a timestamp`);
      }
      return;
    default:
      throw new Rejection(`${field} has an unsupported type`);
  }
}

/** Keep only fields a device may set, and check every value against its column. */
function cleanPatch(
  columns: Record<string, Column>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(patch)) {
    if (SERVER_FIELDS.has(field)) continue;
    const column = columns[field];
    if (!column) throw new Rejection(`Unknown field: ${field}`);
    if (field === 'deletedAt' && value !== null) {
      throw new Rejection('deletedAt can only be cleared; use a delete change to delete');
    }
    checkValue(field, column, value);
    clean[field] = value;
  }
  return clean;
}

function errorMessage(error: unknown): string {
  if (error instanceof Rejection) return error.message;
  const cause = (error as { cause?: { message?: string } } | undefined)?.cause;
  const message = cause?.message ?? (error as Error | undefined)?.message ?? 'Unknown error';
  return message.split('\n')[0] ?? 'Unknown error';
}

async function applyOne(db: Db, userId: string, change: PushChange): Promise<void> {
  if (!isEntityName(change.table)) throw new Rejection(`Unknown table: ${String(change.table)}`);
  if (READ_ONLY_ENTITIES.includes(change.table)) throw new Rejection(`${change.table} is read-only`);
  if (typeof change.id !== 'string' || !UUID.test(change.id)) throw new Rejection('id must be a UUID');
  if (change.op !== 'upsert' && change.op !== 'delete') throw new Rejection('op must be upsert or delete');
  if (change.op === 'upsert' && (typeof change.patch !== 'object' || change.patch === null)) {
    throw new Rejection('patch must be an object');
  }

  const table = tables[change.table] as unknown as AnyPgTable & Record<string, Column>;
  const columns = getTableColumns(table) as Record<string, Column>;
  const immutable = IMMUTABLE_ENTITIES.includes(change.table);

  const [existing] = (await db
    .select()
    .from(table)
    .where(eq(table['id'] as Column, change.id))
    .limit(1)) as Record<string, unknown>[];

  if (change.op === 'delete') {
    if (immutable) throw new Rejection(`${change.table} are append-only: add a reversing entry instead`);
    if (!existing || existing['deletedAt']) return;
    await db
      .update(table)
      .set({
        deletedAt: sql`now()`,
        updatedAt: sql`now()`,
        updatedBy: userId,
        seq: sql`nextval('sync_seq')`,
      })
      .where(eq(table['id'] as Column, change.id));
    return;
  }

  const patch = cleanPatch(columns, change.patch);

  if (!existing) {
    await db.insert(table).values({ ...patch, id: change.id, createdBy: userId, updatedBy: userId });
    return;
  }

  if (immutable) {
    // A retry of an insert that already landed is fine; any real change is not.
    const same = Object.entries(patch).every(([field, value]) => existing[field] === value);
    if (!same) throw new Rejection(`${change.table} are append-only: add a reversing entry instead`);
    return;
  }

  if (Object.keys(patch).length === 0) return;
  await db
    .update(table)
    .set({ ...patch, updatedAt: sql`now()`, updatedBy: userId, seq: sql`nextval('sync_seq')` })
    .where(eq(table['id'] as Column, change.id));
}

/**
 * Apply a batch in order. Each change runs in its own savepoint, so one bad
 * change is rejected on its own without losing the rest. Merging patches
 * field by field is what makes edits "last write wins per field".
 */
export async function applyPush(db: Db, userId: string, changes: PushChange[]): Promise<PushResult[]> {
  return withWriteLock(db, async (tx) => {
    const results: PushResult[] = [];
    for (const change of changes) {
      try {
        await tx.transaction(async (savepoint) => {
          await applyOne(savepoint as unknown as Db, userId, change);
        });
        results.push({ table: change.table, id: change.id, status: 'ok' });
      } catch (error) {
        results.push({
          table: change.table,
          id: change.id,
          status: 'rejected',
          reason: errorMessage(error),
        });
      }
    }
    return results;
  });
}

/** Everything changed after `since`, oldest first, across all tables. */
export async function pullChanges(db: Db, since: number, limit: number): Promise<PullResponse> {
  const rows: PullRow[] = [];

  for (const name of ENTITY_NAMES) {
    const table = tables[name] as unknown as AnyPgTable & Record<string, Column>;
    let selection = getTableColumns(table) as Record<string, Column>;
    if (name === 'users') {
      // Never send password hashes to a device.
      const { passwordHash: _omit, ...safe } = getTableColumns(users);
      selection = safe as unknown as Record<string, Column>;
    }
    const found = (await db
      .select(selection)
      .from(table)
      .where(gt(table['seq'] as Column, since))
      .orderBy(table['seq'] as Column)
      .limit(limit)) as PullRow['row'][];
    for (const row of found) rows.push({ table: name, row });
  }

  rows.sort((a, b) => a.row.seq - b.row.seq);
  const page = rows.slice(0, limit);
  const cursor = page.length > 0 ? page[page.length - 1]!.row.seq : since;
  return { rows: page, cursor, hasMore: rows.length >= limit };
}
