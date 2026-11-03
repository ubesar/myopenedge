import type { M1Series } from "./seasonal-window";

/** Local browser storage (IndexedDB) for large NinjaTrader M1 datasets. */
const DB = "moe-local-m1";
const STORE = "datasets";

export interface LocalDatasetMeta {
  name: string;
  bars: number;
  first: number;
  last: number;
  savedAt: string;
}

interface Row extends LocalDatasetMeta {
  t: ArrayBuffer;
  o: ArrayBuffer;
  c: ArrayBuffer;
  h?: ArrayBuffer;
  l?: ArrayBuffer;
}

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "name" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((res, rej) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      })
  );
}

export async function saveLocalDataset(name: string, s: M1Series): Promise<void> {
  const row: Row = {
    name,
    bars: s.t.length,
    first: s.t[0],
    last: s.t[s.t.length - 1],
    savedAt: new Date().toISOString(),
    t: s.t.buffer as ArrayBuffer,
    o: s.o.buffer as ArrayBuffer,
    c: s.c.buffer as ArrayBuffer,
  };
  if (s.h && s.l) { row.h = s.h.buffer as ArrayBuffer; row.l = s.l.buffer as ArrayBuffer; }
  await tx("readwrite", (st) => st.put(row));
}

export async function listLocalDatasets(): Promise<LocalDatasetMeta[]> {
  const rows = await tx<Row[]>("readonly", (st) => st.getAll());
  return rows.map(({ name, bars, first, last, savedAt }) => ({ name, bars, first, last, savedAt }));
}

export async function loadLocalDataset(name: string): Promise<M1Series | null> {
  const r = await tx<Row | undefined>("readonly", (st) => st.get(name));
  if (!r) return null;
  const s: M1Series = { t: new Int32Array(r.t), o: new Float32Array(r.o), c: new Float32Array(r.c) };
  // datasets imported before high/low support fall back to open/close-derived extremes
  if (r.h && r.l) { s.h = new Float32Array(r.h); s.l = new Float32Array(r.l); }
  return s;
}

export async function deleteLocalDataset(name: string): Promise<void> {
  await tx("readwrite", (st) => st.delete(name));
}

export const minuteToLabel = (m: number) => new Date(m * 60000).toISOString().slice(0, 16).replace("T", " ");
