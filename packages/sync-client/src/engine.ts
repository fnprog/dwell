import {
  ENTITY_NAMES,
  IMMUTABLE_ENTITIES,
  READ_ONLY_ENTITIES,
  type EntityName,
  type LoginResponse,
  type PullResponse,
  type PushResponse,
} from '@subrent/shared';
import { LocalDb, type OutboxEntry, type Row } from './db';

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error' | 'auth';

export interface SyncStatus {
  phase: SyncPhase;
  /** Changes saved on this device but not yet accepted by the server. */
  pending: number;
  /** Changes the server refused. */
  rejected: number;
  lastSyncedAt: string | null;
  error?: string;
}

export interface EngineOptions {
  /** Base URL of the API, e.g. "" for same origin or "http://localhost:8787". */
  baseUrl: string;
  fetchImpl?: typeof fetch;
  /** Changes per push request. */
  batchSize?: number;
  pullLimit?: number;
}

const META_TOKEN = 'token';
const META_USER = 'user';
const META_CURSOR = 'cursor';
const META_LAST_SYNC = 'lastSyncedAt';

export class SyncEngine {
  private status: SyncStatus = { phase: 'idle', pending: 0, rejected: 0, lastSyncedAt: null };
  private listeners = new Set<() => void>();
  private running: Promise<SyncStatus> | null = null;
  private writeListeners = new Set<() => void>();

  constructor(
    readonly db: LocalDb,
    private readonly options: EngineOptions,
  ) {}

  // ---- status -------------------------------------------------------------

  getStatus = (): SyncStatus => this.status;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Called after every local write, so auto-sync can schedule a push. */
  onLocalWrite(listener: () => void): () => void {
    this.writeListeners.add(listener);
    return () => this.writeListeners.delete(listener);
  }

  private setStatus(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch };
    for (const listener of this.listeners) listener();
  }

  async refreshCounts(): Promise<void> {
    const [pending, rejected, lastSyncedAt] = await Promise.all([
      this.db.outbox.count(),
      this.db.rejected.count(),
      this.db.getMeta<string>(META_LAST_SYNC),
    ]);
    this.setStatus({ pending, rejected, lastSyncedAt: lastSyncedAt ?? null });
  }

  // ---- session ------------------------------------------------------------

  async getSession(): Promise<LoginResponse | null> {
    const [token, user] = await Promise.all([
      this.db.getMeta<string>(META_TOKEN),
      this.db.getMeta<LoginResponse['user']>(META_USER),
    ]);
    return token && user ? { token, user } : null;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.fetchApi('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = (await response.json().catch(() => ({}))) as Partial<LoginResponse> & { error?: string };
    if (!response.ok || !body.token || !body.user) {
      throw new Error(body.error ?? `Login failed (${response.status})`);
    }
    await this.db.setMeta(META_TOKEN, body.token);
    await this.db.setMeta(META_USER, body.user);
    this.setStatus({ phase: 'idle', error: undefined });
    return { token: body.token, user: body.user };
  }

  /**
   * Sign out. Refuses while unsent changes exist, because clearing the device
   * would lose them. Local data is cleared so the next person on a shared
   * device does not see the business's records.
   */
  async logout(options: { force?: boolean } = {}): Promise<void> {
    const pending = await this.db.outbox.count();
    if (pending > 0 && !options.force) {
      throw new Error(`${pending} change(s) have not been sent yet. Connect and sync before signing out.`);
    }
    await this.db.transaction('rw', [...ENTITY_NAMES.map((n) => this.db.entity(n)), this.db.outbox, this.db.rejected, this.db.meta], async () => {
      for (const name of ENTITY_NAMES) await this.db.entity(name).clear();
      await this.db.outbox.clear();
      await this.db.rejected.clear();
      await this.db.meta.clear();
    });
    this.setStatus({ phase: 'idle', pending: 0, rejected: 0, lastSyncedAt: null, error: undefined });
  }

  // ---- local writes -------------------------------------------------------

  private assertWritable(table: EntityName, action: 'update' | 'delete'): void {
    if (READ_ONLY_ENTITIES.includes(table)) throw new Error(`${table} cannot be changed from a device`);
    if (IMMUTABLE_ENTITIES.includes(table)) {
      throw new Error(`${table} are append-only: add a reversing entry instead of trying to ${action} one`);
    }
  }

  /** Save a new row on this device and queue it for the server. Works offline. */
  async create(table: EntityName, data: Record<string, unknown>): Promise<Row> {
    if (READ_ONLY_ENTITIES.includes(table)) throw new Error(`${table} cannot be changed from a device`);
    const session = await this.getSession();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const row: Row = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
      createdBy: session?.user.id ?? null,
      updatedBy: session?.user.id ?? null,
      deletedAt: null,
    };
    await this.db.transaction('rw', [this.db.entity(table), this.db.outbox], async () => {
      await this.db.entity(table).add(row);
      await this.db.outbox.add({ table, rowId: id, op: 'upsert', patch: { ...data }, at: now });
    });
    await this.afterLocalWrite();
    return row;
  }

  /** Change fields of an existing row. Only the changed fields are sent. */
  async update(table: EntityName, id: string, patch: Record<string, unknown>): Promise<Row> {
    this.assertWritable(table, 'update');
    const now = new Date().toISOString();
    let updated!: Row;
    await this.db.transaction('rw', [this.db.entity(table), this.db.outbox], async () => {
      const existing = await this.db.entity(table).get(id);
      if (!existing) throw new Error(`${table} ${id} not found on this device`);
      updated = { ...existing, ...patch, updatedAt: now };
      await this.db.entity(table).put(updated);
      await this.db.outbox.add({ table, rowId: id, op: 'upsert', patch: { ...patch }, at: now });
    });
    await this.afterLocalWrite();
    return updated;
  }

  /** Soft-delete: the row stays, marked deleted, so the deletion can sync. */
  async remove(table: EntityName, id: string): Promise<void> {
    this.assertWritable(table, 'delete');
    const now = new Date().toISOString();
    await this.db.transaction('rw', [this.db.entity(table), this.db.outbox], async () => {
      const existing = await this.db.entity(table).get(id);
      if (!existing) return;
      await this.db.entity(table).put({ ...existing, deletedAt: now, updatedAt: now });
      await this.db.outbox.add({ table, rowId: id, op: 'delete', patch: {}, at: now });
    });
    await this.afterLocalWrite();
  }

  private async afterLocalWrite(): Promise<void> {
    await this.refreshCounts();
    for (const listener of this.writeListeners) listener();
  }

  // ---- sync ---------------------------------------------------------------

  /** Push pending changes, then pull everything new. Safe to call any time; calls overlap into one run. */
  syncOnce(): Promise<SyncStatus> {
    if (!this.running) {
      this.running = this.runSync().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async runSync(): Promise<SyncStatus> {
    const token = await this.db.getMeta<string>(META_TOKEN);
    if (!token) {
      await this.refreshCounts();
      this.setStatus({ phase: 'auth' });
      return this.status;
    }

    this.setStatus({ phase: 'syncing', error: undefined });
    try {
      await this.push(token);
      await this.pull(token);
      const now = new Date().toISOString();
      await this.db.setMeta(META_LAST_SYNC, now);
      await this.refreshCounts();
      this.setStatus({ phase: 'idle' });
    } catch (error) {
      await this.refreshCounts();
      if (error instanceof OfflineError) this.setStatus({ phase: 'offline' });
      else if (error instanceof AuthError) this.setStatus({ phase: 'auth' });
      else this.setStatus({ phase: 'error', error: (error as Error).message });
    }
    return this.status;
  }

  private async push(token: string): Promise<void> {
    const batchSize = this.options.batchSize ?? 100;
    let resetCursor = false;

    for (;;) {
      const entries = await this.db.outbox.orderBy('seq').limit(batchSize).toArray();
      if (entries.length === 0) break;

      const response = await this.fetchApi('/api/sync/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          changes: entries.map((e) => ({ table: e.table, id: e.rowId, op: e.op, patch: e.patch })),
        }),
      });
      if (response.status === 401) throw new AuthError();
      if (!response.ok) throw new Error(`Push failed (${response.status})`);

      const { results } = (await response.json()) as PushResponse;
      if (results.length !== entries.length) throw new Error('Push response did not match the request');

      const rejections: { entry: OutboxEntry; reason: string }[] = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') rejections.push({ entry: entries[index]!, reason: result.reason });
      });

      await this.db.transaction(
        'rw',
        [...ENTITY_NAMES.map((n) => this.db.entity(n)), this.db.outbox, this.db.rejected],
        async () => {
          await this.db.outbox.bulkDelete(entries.map((e) => e.seq!));
          for (const { entry, reason } of rejections) {
            await this.db.rejected.add({
              table: entry.table,
              rowId: entry.rowId,
              op: entry.op,
              patch: entry.patch,
              reason,
              at: new Date().toISOString(),
            });
            const local = await this.db.entity(entry.table).get(entry.rowId);
            if (!local) continue;
            // A row the server never accepted is a ghost: drop it. A row it
            // already knew has diverged: re-pull everything to restore server truth.
            if (local['seq'] === undefined) await this.db.entity(entry.table).delete(entry.rowId);
            else resetCursor = true;
          }
        },
      );
    }

    if (resetCursor) await this.db.setMeta(META_CURSOR, 0);
  }

  private async pull(token: string): Promise<void> {
    const limit = this.options.pullLimit ?? 500;
    let cursor = (await this.db.getMeta<number>(META_CURSOR)) ?? 0;

    for (;;) {
      const response = await this.fetchApi(`/api/sync/pull?since=${cursor}&limit=${limit}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (response.status === 401) throw new AuthError();
      if (!response.ok) throw new Error(`Pull failed (${response.status})`);
      const page = (await response.json()) as PullResponse;

      await this.db.transaction(
        'rw',
        [...ENTITY_NAMES.map((n) => this.db.entity(n)), this.db.outbox, this.db.meta],
        async () => {
          // Changes made on this device but not yet sent stay on top of the
          // server's version, so a pull never undoes work the person just did.
          const pending = await this.db.outbox
            .where('rowId')
            .anyOf(page.rows.map((r) => r.row.id))
            .sortBy('seq');
          const byRow = new Map<string, OutboxEntry[]>();
          for (const entry of pending) byRow.set(entry.rowId, [...(byRow.get(entry.rowId) ?? []), entry]);

          for (const { table, row } of page.rows) {
            const merged: Row = { ...row };
            for (const entry of byRow.get(row.id) ?? []) {
              if (entry.op === 'delete') merged['deletedAt'] = entry.at;
              else Object.assign(merged, entry.patch);
            }
            await this.db.entity(table).put(merged);
          }
          await this.db.setMeta(META_CURSOR, page.cursor);
        },
      );

      cursor = page.cursor;
      if (!page.hasMore) break;
    }
  }

  private async fetchApi(path: string, init?: RequestInit): Promise<Response> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    try {
      return await fetchImpl(`${this.options.baseUrl}${path}`, init);
    } catch {
      // fetch only throws when it could not reach the server at all.
      throw new OfflineError();
    }
  }
}

class OfflineError extends Error {
  constructor() {
    super('offline');
  }
}

class AuthError extends Error {
  constructor() {
    super('not signed in');
  }
}
