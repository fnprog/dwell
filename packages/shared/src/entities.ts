/**
 * The 13 synced tables from the spec. The server (Drizzle schema) and the
 * client (Dexie stores) both derive from this list so they cannot drift.
 */
export const ENTITY_NAMES = [
  'users',
  'sites',
  'landlords',
  'leases',
  'units',
  'tenants',
  'tenancies',
  'scheduleEntries',
  'payments',
  'expenses',
  'items',
  'repairs',
  'documents',
] as const;

export type EntityName = (typeof ENTITY_NAMES)[number];

/**
 * Money history is append-only: a correction is a new reversing entry,
 * never an edit or a delete of an existing row.
 */
export const IMMUTABLE_ENTITIES: readonly EntityName[] = ['payments', 'expenses'];

/** Users are managed by an admin command, never pushed from a device. */
export const READ_ONLY_ENTITIES: readonly EntityName[] = ['users'];

export function isEntityName(value: unknown): value is EntityName {
  return typeof value === 'string' && (ENTITY_NAMES as readonly string[]).includes(value);
}

export type UserRole = 'owner' | 'staff';

/** Fields every synced row carries. */
export interface SyncFields {
  id: string;
  /** Server sync cursor. Assigned by the server on every write. */
  seq: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: string | null;
}

/** Fields a device is allowed to set itself. Everything else is server-controlled. */
export const SERVER_CONTROLLED_FIELDS = [
  'id',
  'seq',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
] as const;

export type SyncOp = 'upsert' | 'delete';

export interface PushChange {
  table: EntityName;
  id: string;
  op: SyncOp;
  /** Only the fields that changed (or all fields for a new row). */
  patch: Record<string, unknown>;
}

export interface PushRequest {
  changes: PushChange[];
}

export type PushResult =
  | { table: EntityName; id: string; status: 'ok' }
  | { table: EntityName; id: string; status: 'rejected'; reason: string };

export interface PushResponse {
  results: PushResult[];
}

export interface PullRow {
  table: EntityName;
  row: Record<string, unknown> & { id: string; seq: number };
}

export interface PullResponse {
  rows: PullRow[];
  /** Pass this back as `since` on the next pull. */
  cursor: number;
  hasMore: boolean;
}

export interface LoginResponse {
  token: string;
  user: { id: string; name: string; email: string; role: UserRole };
}
