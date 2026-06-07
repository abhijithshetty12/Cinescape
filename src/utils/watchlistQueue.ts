/* IndexedDB-backed queue for watchlist operations.

Ops are enqueued by the app when offline.
A service worker drains them on Background Sync or when triggered via postMessage.
*/

export type WatchlistOpType = 'watchlist_add' | 'watchlist_remove';

export type WatchlistOp = {
  id?: string;
  type: WatchlistOpType;
  userId: string;
  movieId: number;
  title?: string;
  releaseDate?: string;
  genres?: string[];
  posterPath?: string;
  mediaType?: 'movie' | 'tv';
  createdAt: number;
};

const DB_NAME = 'cinescape_offline_db';
const STORE_NAME = 'watchlist_ops';
const DB_VERSION = 1;

function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const openReq = indexedDB.open(DB_NAME, DB_VERSION);
    openReq.onupgradeneeded = () => {
      const db = openReq.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    openReq.onsuccess = () => resolve(openReq.result);
    openReq.onerror = () => reject(openReq.error);
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  return getDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        fn(store)
          .then((res) => {
            tx.oncomplete = () => resolve(res);
          })
          .catch((err) => reject(err));
      })
  );
}

function makeId() {
  // Good enough uniqueness for a local queue.
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function enqueueWatchlistOp(op: Omit<WatchlistOp, 'id' | 'createdAt'>) {
  const record: WatchlistOp & { id: string } = {
    ...op,
    id: makeId(),
    createdAt: Date.now(),
  };

  await withStore('readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.add(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });

  return record.id!;
}

export async function getWatchlistOps(): Promise<WatchlistOp[]> {
  return withStore('readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as WatchlistOp[]);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function clearWatchlistOpsByIds(ids: string[]) {
  if (!ids.length) return;
  await withStore('readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      let remaining = ids.length;
      const done = () => {
        remaining -= 1;
        if (remaining <= 0) resolve();
      };

      ids.forEach((id) => {
        const req = store.delete(id);
        req.onsuccess = done;
        req.onerror = () => reject(req.error);
      });
    });
  });
}

export async function clearWatchlistOps() {
  const ops = await getWatchlistOps();
  await clearWatchlistOpsByIds(ops.map((o: any) => o.id).filter(Boolean));
}

export async function registerWatchlistSync() {
  if (!('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.ready;

  // Background Sync is not supported on all browsers.
  // If unavailable, the app will attempt to flush when coming online.
  const anyReg = reg as any;
  if (anyReg && 'sync' in anyReg) {
    try {
      await anyReg.sync.register('watchlist-sync');
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export async function flushWatchlistOpsFromClient(apply: (op: WatchlistOp) => Promise<void>) {
  if (!navigator.onLine) return;
  const ops = await getWatchlistOps();
  if (!ops.length) return;

  // Apply sequentially to avoid race conditions
  const succeededIds: string[] = [];
  for (const op of ops) {
    try {
      await apply(op);
      if (op.id) succeededIds.push(op.id);
    } catch (e) {
      console.error('Failed to apply queued watchlist op', op, e);
      // Stop on first failure to prevent diverging state
      break;
    }
  }

  if (succeededIds.length) {
    await clearWatchlistOpsByIds(succeededIds);
  }
}


