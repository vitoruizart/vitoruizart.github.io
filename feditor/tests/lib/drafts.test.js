import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import { scheduleDraftSave, loadDraft } from '../../js/lib/drafts.js';
import { _resetForTests } from '../../js/db.js';

beforeEach(async () => {
  await _resetForTests();
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('feditor');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
});

describe('drafts', () => {
  it('debounces and persists placement + refs', async () => {
    const state = {
      placement: { tx: 0.5, ty: 0.5, scale: 0.3, rotate: 10, rotateX: 0, rotateY: 0 },
      frame: { kind: 'bundled', id: 'gold-classic', sliceWidth: 0.28, borderFrac: 0.06 },
      room: { kind: 'bundled', id: 'living-warm' },
      painting: { blob: new Blob(['x']), naturalW: 100, naturalH: 80 }
    };
    scheduleDraftSave(state, 10);
    await new Promise((r) => setTimeout(r, 50));
    const got = await loadDraft();
    expect(got).toBeTruthy();
    expect(got.placement.rotate).toBe(10);
    expect(got.frameRef.id).toBe('gold-classic');
    expect(got.roomRef.id).toBe('living-warm');
    expect(got.paintingW).toBe(100);
  });

  it('persists all mat fields in roomRef', async () => {
    const state = {
      placement: { tx: 0.5, ty: 0.5, scale: 0.3, rotate: 0, rotateX: 0, rotateY: 0 },
      frame: null,
      room: { kind: 'mat', color: '#abcdef', padH: 0.12, padV: 0.08, lockPad: false },
      painting: { blob: new Blob(['x']), naturalW: 100, naturalH: 80 }
    };
    scheduleDraftSave(state, 10);
    await new Promise((r) => setTimeout(r, 50));
    const got = await loadDraft();
    expect(got.roomRef).toEqual({
      kind: 'mat',
      color: '#abcdef',
      padH: 0.12,
      padV: 0.08,
      lockPad: false
    });
  });

  it('persists kind only for a "none" roomRef', async () => {
    const state = {
      placement: { tx: 0.5, ty: 0.5, scale: 0.3, rotate: 0, rotateX: 0, rotateY: 0 },
      frame: null,
      room: { kind: 'none' },
      painting: { blob: new Blob(['x']), naturalW: 100, naturalH: 80 }
    };
    scheduleDraftSave(state, 10);
    await new Promise((r) => setTimeout(r, 50));
    const got = await loadDraft();
    expect(got.roomRef).toEqual({ kind: 'none' });
  });

  it('only the last call within the debounce window persists', async () => {
    const base = {
      placement: { tx: 0.5, ty: 0.5, scale: 0.3, rotate: 0, rotateX: 0, rotateY: 0 },
      frame: null, room: null,
      painting: { blob: new Blob(['x']), naturalW: 100, naturalH: 80 }
    };
    scheduleDraftSave({ ...base, placement: { ...base.placement, rotate: 1 } }, 30);
    scheduleDraftSave({ ...base, placement: { ...base.placement, rotate: 2 } }, 30);
    scheduleDraftSave({ ...base, placement: { ...base.placement, rotate: 3 } }, 30);
    await new Promise((r) => setTimeout(r, 80));
    const got = await loadDraft();
    expect(got.placement.rotate).toBe(3);
  });
});
