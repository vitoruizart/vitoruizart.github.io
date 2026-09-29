import { DB_NAME, DB_VERSION } from './lib/constants.js';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode = 'readonly') {
  return openDb().then((db) => db.transaction(store, mode).objectStore(store));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function put(store, value) {
  const s = await tx(store, 'readwrite');
  return reqToPromise(s.put(value));
}

export async function get(store, key) {
  const s = await tx(store);
  return reqToPromise(s.get(key));
}

export async function del(store, key) {
  const s = await tx(store, 'readwrite');
  return reqToPromise(s.delete(key));
}

export async function _resetForTests() {
  if (dbPromise) {
    try { (await dbPromise).close(); } catch (_) {}
  }
  dbPromise = null;
}
