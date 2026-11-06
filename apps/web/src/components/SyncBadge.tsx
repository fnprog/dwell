import { engine, useSyncStatus } from '../sync';

const LABELS = {
  idle: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline',
  error: 'Sync problem',
  auth: 'Sign in again',
} as const;

export function SyncBadge() {
  const status = useSyncStatus();
  const waiting = status.pending > 0;
  const tone = status.phase === 'error' || status.phase === 'auth' || status.rejected > 0 ? 'bad' : waiting || status.phase === 'offline' ? 'warn' : 'ok';
  const text = waiting && status.phase !== 'syncing' ? `${LABELS[status.phase]} · ${status.pending} waiting` : LABELS[status.phase];

  return (
    <button className={`badge badge-${tone}`} onClick={() => void engine.syncOnce()} title="Tap to sync now">
      <span className="dot" aria-hidden="true" />
      {text}
    </button>
  );
}
