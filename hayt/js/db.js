// IndexedDB wrapper — raw API, single database "hayt"
// Stores: moods, changelog, meta

const DB_NAME = 'hayt';
const DB_VERSION = 1;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('moods')) {
        const store = db.createObjectStore('moods', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('changelog')) {
        const cl = db.createObjectStore('changelog', { keyPath: 'id' });
        cl.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeNames, mode = 'readonly') {
  return open().then(db => {
    const t = db.transaction(storeNames, mode);
    return { tx: t, stores: storeNames.map(n => t.objectStore(n)) };
  });
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// --- Moods ---

export async function putMood(mood) {
  const { stores } = await tx(['moods'], 'readwrite');
  return promisify(stores[0].put(mood));
}

export async function getMood(id) {
  const { stores } = await tx(['moods']);
  return promisify(stores[0].get(id));
}

export async function deleteMood(id) {
  const { stores } = await tx(['moods'], 'readwrite');
  return promisify(stores[0].delete(id));
}

export async function getMoodsByDate(dateStr) {
  const { stores } = await tx(['moods']);
  const idx = stores[0].index('date');
  return promisify(idx.getAll(dateStr));
}

export async function getAllMoods() {
  const { stores } = await tx(['moods']);
  return promisify(stores[0].getAll());
}

export async function getRecentMoods(since) {
  const { stores } = await tx(['moods']);
  const idx = stores[0].index('timestamp');
  const range = IDBKeyRange.lowerBound(since);
  return promisify(idx.getAll(range));
}

// --- Changelog ---

export async function addChangeEntry(entry) {
  const { stores } = await tx(['changelog'], 'readwrite');
  return promisify(stores[0].put(entry));
}

export async function getAllChangeEntries() {
  const { stores } = await tx(['changelog']);
  const idx = stores[0].index('timestamp');
  return promisify(idx.getAll());
}

export async function clearChangeEntries() {
  const { stores } = await tx(['changelog'], 'readwrite');
  return promisify(stores[0].clear());
}

export async function deleteChangeEntries(ids) {
  const { stores } = await tx(['changelog'], 'readwrite');
  for (const id of ids) await promisify(stores[0].delete(id));
}

// --- Meta ---

export async function getMeta(key) {
  const { stores } = await tx(['meta']);
  return promisify(stores[0].get(key));
}

export async function setMeta(key, value) {
  const { stores } = await tx(['meta'], 'readwrite');
  return promisify(stores[0].put({ key, ...value }));
}
