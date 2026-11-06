import Dexie, { type DexieOptions, type Table } from 'dexie';
import { ENTITY_NAMES, type EntityName, type SyncOp } from '@subrent/shared';

export type Row = Record<string, unknown> & { id: string };

/** A change waiting to be sent. Entries are sent in order, oldest first. */
export interface OutboxEntry {
  /** Auto-increment; defines send order across all tables. */
  seq?: number;
  table: EntityName;
  rowId: string;
  op: SyncOp;
  patch: Record<string, unknown>;
  at: string;
}

/** A change the server refused. Kept so the person can see what was lost and why. */
export interface RejectedEntry {
  id?: number;
  table: EntityName;
  rowId: string;
  op: SyncOp;
  patch: Record<string, unknown>;
  reason: string;
  at: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

/**
 * The on-device database: one table per synced entity, plus the outbox and
 * a little metadata (session token, sync cursor).
 *
 * Indexes are deliberately minimal for the foundation. Later phases add the
 * indexes they need (for example leases by siteId) in a new Dexie version.
 */
export class LocalDb extends Dexie {
  meta!: Table<MetaEntry, string>;
  outbox!: Table<OutboxEntry, number>;
  rejected!: Table<RejectedEntry, number>;

  constructor(name: string, options?: DexieOptions) {
    super(name, options);
    const stores: Record<string, string> = {
      meta: 'key',
      outbox: '++seq, rowId',
      rejected: '++id',
    };
    for (const entity of ENTITY_NAMES) stores[entity] = 'id, deletedAt, updatedAt';
    this.version(1).stores(stores);

    // Version 2 (Phase 1): indexes for looking children up by their parent.
    // Only the changed tables are listed; Dexie keeps the rest as they were.
    this.version(2).stores({
      leases: 'id, deletedAt, updatedAt, siteId, landlordId',
      units: 'id, deletedAt, updatedAt, leaseId',
      tenancies: 'id, deletedAt, updatedAt, unitId, tenantId',
      scheduleEntries: 'id, deletedAt, updatedAt, dueDate, leaseId, tenancyId',
    });
  }

  entity(name: EntityName): Table<Row, string> {
    return this.table(name) as Table<Row, string>;
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    const entry = await this.meta.get(key);
    return entry?.value as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.meta.put({ key, value });
  }
}
