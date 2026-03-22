import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  putMood, getMood, deleteMood, getMoodsByDate, getAllMoods, getRecentMoods,
  addChangeEntry, getAllChangeEntries, clearChangeEntries, deleteChangeEntries,
  getMeta, setMeta, getTombstones, addTombstone, clearTombstones,
  DB_VERSION, MIGRATIONS,
} from '../js/db.js';

// Each test needs a fresh DB. fake-indexeddb/auto replaces globalThis.indexedDB
// but db.js caches its dbPromise. We need to reset it between tests.
// Since db.js caches the promise internally, we rely on the first open creating the schema
// and subsequent operations sharing it.

describe('moods CRUD', () => {
  const mood1 = { id: 'm1', mood: 4, date: '2025-03-15', timestamp: 1000 };
  const mood2 = { id: 'm2', mood: 2, date: '2025-03-15', timestamp: 2000 };
  const mood3 = { id: 'm3', mood: 5, date: '2025-03-16', timestamp: 3000 };

  it('putMood and getMood roundtrip', async () => {
    await putMood(mood1);
    const result = await getMood('m1');
    expect(result).toEqual(mood1);
  });

  it('putMood updates existing', async () => {
    await putMood(mood1);
    const updated = { ...mood1, mood: 5 };
    await putMood(updated);
    const result = await getMood('m1');
    expect(result.mood).toBe(5);
  });

  it('getMood returns undefined for missing id', async () => {
    const result = await getMood('nonexistent');
    expect(result).toBeUndefined();
  });

  it('deleteMood removes entry', async () => {
    await putMood({ id: 'del-test', mood: 3, date: '2025-01-01', timestamp: 100 });
    await deleteMood('del-test');
    const result = await getMood('del-test');
    expect(result).toBeUndefined();
  });

  it('getMoodsByDate returns entries for date', async () => {
    await putMood(mood1);
    await putMood(mood2);
    await putMood(mood3);
    const results = await getMoodsByDate('2025-03-15');
    expect(results).toHaveLength(2);
    expect(results.map(r => r.id).sort()).toEqual(['m1', 'm2']);
  });

  it('getMoodsByDate returns empty for unknown date', async () => {
    const results = await getMoodsByDate('1999-01-01');
    expect(results).toHaveLength(0);
  });

  it('getAllMoods returns all entries', async () => {
    await putMood(mood1);
    await putMood(mood2);
    await putMood(mood3);
    const results = await getAllMoods();
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('getRecentMoods filters by timestamp', async () => {
    await putMood(mood1); // ts=1000
    await putMood(mood2); // ts=2000
    await putMood(mood3); // ts=3000
    const results = await getRecentMoods(2000);
    const ids = results.map(r => r.id);
    expect(ids).toContain('m2');
    expect(ids).toContain('m3');
  });
});

describe('changelog', () => {
  it('addChangeEntry and getAllChangeEntries roundtrip', async () => {
    const entry = { id: 'c1', timestamp: 5000, entityId: 'm1', operation: 'put', data: { mood: 3 } };
    await addChangeEntry(entry);
    const all = await getAllChangeEntries();
    const found = all.find(e => e.id === 'c1');
    expect(found).toBeDefined();
    expect(found.operation).toBe('put');
  });

  it('clearChangeEntries empties the store', async () => {
    await addChangeEntry({ id: 'c-clear', timestamp: 6000, entityId: 'x', operation: 'put' });
    await clearChangeEntries();
    const all = await getAllChangeEntries();
    expect(all).toHaveLength(0);
  });

  it('deleteChangeEntries removes specific entries', async () => {
    await addChangeEntry({ id: 'c-del-1', timestamp: 7000, entityId: 'x', operation: 'put' });
    await addChangeEntry({ id: 'c-del-2', timestamp: 7001, entityId: 'y', operation: 'put' });
    await deleteChangeEntries(['c-del-1']);
    const all = await getAllChangeEntries();
    const ids = all.map(e => e.id);
    expect(ids).not.toContain('c-del-1');
    expect(ids).toContain('c-del-2');
    // Cleanup
    await clearChangeEntries();
  });
});

describe('migrations', () => {
  it('DB_VERSION matches highest migration key', () => {
    const maxVersion = Math.max(...Object.keys(MIGRATIONS).map(Number));
    expect(DB_VERSION).toBe(maxVersion);
  });

  it('has a migration for every version from 1 to DB_VERSION', () => {
    for (let v = 1; v <= DB_VERSION; v++) {
      expect(MIGRATIONS[v]).toBeDefined();
      expect(typeof MIGRATIONS[v]).toBe('function');
    }
  });

  it('fresh install creates all expected stores (via CRUD operations)', async () => {
    // The DB was opened fresh by earlier tests — verify stores work
    await putMood({ id: 'mig-test', mood: 3, date: '2025-01-01', timestamp: 1 });
    const result = await getMood('mig-test');
    expect(result).toBeDefined();

    await addChangeEntry({ id: 'mig-cl', timestamp: 1, entityId: 'x', operation: 'put' });
    const entries = await getAllChangeEntries();
    expect(entries.length).toBeGreaterThan(0);

    await setMeta('mig-meta', { val: 1 });
    const meta = await getMeta('mig-meta');
    expect(meta.val).toBe(1);
  });
});

describe('meta', () => {
  it('setMeta and getMeta roundtrip', async () => {
    await setMeta('sync', { lastSyncAt: 12345 });
    const result = await getMeta('sync');
    expect(result.key).toBe('sync');
    expect(result.lastSyncAt).toBe(12345);
  });

  it('getMeta returns undefined for missing key', async () => {
    const result = await getMeta('nonexistent-meta');
    expect(result).toBeUndefined();
  });
});

describe('tombstones', () => {
  it('getTombstones returns empty set when none exist', async () => {
    const ts = await getTombstones();
    expect(ts.size).toBe(0);
  });

  it('addTombstone persists and is retrievable', async () => {
    await addTombstone('mood-1');
    await addTombstone('mood-2');
    const ts = await getTombstones();
    expect(ts.has('mood-1')).toBe(true);
    expect(ts.has('mood-2')).toBe(true);
    expect(ts.size).toBe(2);
  });

  it('addTombstone does not duplicate', async () => {
    await addTombstone('mood-dup');
    await addTombstone('mood-dup');
    const ts = await getTombstones();
    expect([...ts].filter(id => id === 'mood-dup').length).toBe(1);
  });

  it('clearTombstones removes specified IDs', async () => {
    await addTombstone('keep');
    await addTombstone('remove');
    await clearTombstones(['remove']);
    const ts = await getTombstones();
    expect(ts.has('keep')).toBe(true);
    expect(ts.has('remove')).toBe(false);
  });
});
