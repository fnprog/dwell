import type { SyncEngine } from './engine';

export interface AutoSyncOptions {
  /** Background poll while the app is open. */
  intervalMs?: number;
  /** Wait this long after a local write so a burst of edits goes out as one push. */
  writeDebounceMs?: number;
}

/**
 * Keep an engine syncing: on start, when the connection returns, when the app
 * comes back to the foreground, shortly after local writes, and on a timer.
 * Returns a function that stops it.
 */
export function startAutoSync(engine: SyncEngine, options: AutoSyncOptions = {}): () => void {
  const { intervalMs = 30_000, writeDebounceMs = 800 } = options;
  const run = () => void engine.syncOnce();

  let debounce: ReturnType<typeof setTimeout> | undefined;
  const afterWrite = () => {
    clearTimeout(debounce);
    debounce = setTimeout(run, writeDebounceMs);
  };

  const onVisible = () => {
    if (globalThis.document?.visibilityState === 'visible') run();
  };

  const stopWrites = engine.onLocalWrite(afterWrite);
  const timer = setInterval(run, intervalMs);
  globalThis.addEventListener?.('online', run);
  globalThis.document?.addEventListener('visibilitychange', onVisible);
  void engine.refreshCounts().then(run);

  return () => {
    stopWrites();
    clearTimeout(debounce);
    clearInterval(timer);
    globalThis.removeEventListener?.('online', run);
    globalThis.document?.removeEventListener('visibilitychange', onVisible);
  };
}
