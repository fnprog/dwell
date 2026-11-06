import { useSyncExternalStore } from 'react';
import { LocalDb, SyncEngine, startAutoSync, type SyncStatus } from '@subrent/sync-client';
import type { LoginResponse } from '@subrent/shared';
import { createActions } from './data/actions';

/**
 * One on-device database and one sync engine for the whole app.
 * The API is on the same origin (the dev server proxies /api).
 */
export const localDb = new LocalDb('subrent');
export const engine = new SyncEngine(localDb, { baseUrl: '' });

// ---- session: a tiny store so the UI reacts to sign-in and sign-out ----------

type Session = LoginResponse | null | undefined; // undefined = still loading

let session: Session;
const sessionListeners = new Set<() => void>();

function setSession(next: Session): void {
  session = next;
  for (const listener of sessionListeners) listener();
}

let stopAutoSync: (() => void) | null = null;

function applySession(next: LoginResponse | null): void {
  setSession(next);
  stopAutoSync?.();
  stopAutoSync = next ? startAutoSync(engine) : null;
}

export async function restoreSession(): Promise<void> {
  // Works offline: the token and user were stored on this device at sign-in.
  applySession(await engine.getSession());
}

export async function signIn(email: string, password: string): Promise<void> {
  applySession(await engine.login(email, password));
}

export async function signOut(): Promise<void> {
  await engine.logout();
  applySession(null);
}

export function useSession(): Session {
  return useSyncExternalStore(
    (listener) => {
      sessionListeners.add(listener);
      return () => sessionListeners.delete(listener);
    },
    () => session,
  );
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(engine.subscribe, engine.getStatus);
}

// ---- domain actions on top of the engine -------------------------------------

export const actions = createActions(engine);
