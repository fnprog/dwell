import { useLiveQuery } from 'dexie-react-hooks';
import { engine, localDb, useSyncStatus } from '../sync';

export function SyncPage() {
  const status = useSyncStatus();
  const rejected = useLiveQuery(() => localDb.rejected.orderBy('id').reverse().toArray(), []);

  return (
    <>
      <h1>Sync</h1>
      <div className="card stack">
        <div className="kv"><span>State</span><strong>{status.phase}</strong></div>
        <div className="kv"><span>Waiting to send</span><strong>{status.pending}</strong></div>
        <div className="kv">
          <span>Last synced</span>
          <strong>{status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : 'Never'}</strong>
        </div>
        {status.error && <p className="error">{status.error}</p>}
        <button className="primary" onClick={() => void engine.syncOnce()}>Sync now</button>
      </div>

      <h2>Changes the server refused</h2>
      {rejected && rejected.length > 0 ? (
        <ul className="list">
          {rejected.map((entry) => (
            <li key={entry.id} className="card">
              <div className="title">{entry.table} · {entry.op}</div>
              <div className="error small">{entry.reason}</div>
              <button className="ghost" onClick={() => void localDb.rejected.delete(entry.id!).then(() => engine.refreshCounts())}>
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">None.</p>
      )}
    </>
  );
}
