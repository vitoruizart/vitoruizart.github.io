import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import { put, get, getAll, del, _resetForTests } from '../js/db.js';

beforeEach(async () => {
  await _resetForTests();
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('feditor');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('deleteDatabase blocked'));
  });
});

describe('db', () => {
  it('puts and gets a frame record', async () => {
    await put('frames', { id: 'f1', name: 'Test', sliceWidth: 0.25 });
    const got = await get('frames', 'f1');
    expect(got.name).toBe('Test');
    expect(got.sliceWidth).toBe(0.25);
  });

  it('lists all rooms via getAll', async () => {
    await put('rooms', { id: 'r1', name: 'Living' });
    await put('rooms', { id: 'r2', name: 'Bedroom' });
    const all = await getAll('rooms');
    expect(all).toHaveLength(2);
    expect(all.map(x => x.id).sort()).toEqual(['r1', 'r2']);
  });

  it('deletes a draft record', async () => {
    await put('drafts', { id: 'current', placement: { tx: 0.5 } });
    await del('drafts', 'current');
    const got = await get('drafts', 'current');
    expect(got).toBeUndefined();
  });
});
