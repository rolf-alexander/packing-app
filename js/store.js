// Storage: everything lives in IndexedDB on this device.
// The whole database is small, so it is loaded into memory at start-up and
// every change is written straight back to IndexedDB.
import { uid } from './util.js';

const DB_NAME = 'packing-app';
const DB_VERSION = 1;
export const STORES = ['items', 'trips', 'tripItems', 'templates', 'tasks', 'checks'];

export const data = { items: [], trips: [], tripItems: [], templates: [], tasks: [], checks: [], meta: {} };

let db;

const result = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
const finished = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Saving failed'));
  });

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Close other open copies of the app and try again'));
  });
}

export async function load() {
  db = db || (await openDB());
  const names = [...STORES, 'meta'];
  const tx = db.transaction(names, 'readonly');
  const rows = await Promise.all(names.map((n) => result(tx.objectStore(n).getAll())));
  STORES.forEach((s, i) => (data[s] = rows[i]));
  data.meta = Object.fromEntries(rows[STORES.length].map((r) => [r.key, r.value]));
}

export const find = (store, id) => data[store].find((x) => x.id === id);

export async function save(store, ...objs) {
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const o of objs) {
    if (!o.id) o.id = uid();
    o.updated = Date.now();
    os.put(o);
    const list = data[store];
    const i = list.findIndex((x) => x.id === o.id);
    if (i >= 0) list[i] = o;
    else list.push(o);
  }
  await finished(tx);
  return objs[0];
}

export async function remove(store, ...ids) {
  if (!ids.length) return;
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  ids.forEach((id) => os.delete(id));
  const gone = new Set(ids);
  data[store] = data[store].filter((x) => !gone.has(x.id));
  await finished(tx);
}

export const meta = (key, fallback) => (key in data.meta ? data.meta[key] : fallback);

export async function setMeta(key, value) {
  data.meta[key] = value;
  const tx = db.transaction('meta', 'readwrite');
  tx.objectStore('meta').put({ key, value });
  await finished(tx);
}

export function snapshot() {
  return {
    app: 'packing-app',
    format: 1,
    exported: new Date().toISOString(),
    ...Object.fromEntries(STORES.map((s) => [s, data[s]])),
    meta: data.meta,
  };
}

// Wipes the database and fills it with the contents of a backup (or an empty object).
export async function replaceAll(snap) {
  const names = [...STORES, 'meta'];
  const tx = db.transaction(names, 'readwrite');
  for (const n of names) tx.objectStore(n).clear();
  for (const s of STORES) for (const o of snap[s] || []) tx.objectStore(s).put(o);
  for (const [key, value] of Object.entries(snap.meta || {})) tx.objectStore('meta').put({ key, value });
  await finished(tx);
  await load();
}
