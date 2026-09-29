import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import { saveDraft, loadDraft, clearDraft, sanitizeSettings, isRestorableDraft } from '../../js/lib/drafts.js';
import { _resetForTests } from '../../js/db.js';
import { defaultSettings } from '../../js/state.js';
import { MAX_COLORS, MIN_COLORS, MAX_FILE_BYTES } from '../../js/lib/constants.js';
import { MAX_ZOOM } from '../../js/lib/crop.js';

beforeEach(async () => {
  await _resetForTests();
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('pcruz');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('deleteDatabase blocked'));
  });
});

describe('sanitizeSettings', () => {
  it('passes valid settings through unchanged', () => {
    const s = { frameId: '30x40', count: 18, orientation: 'landscape', crop: { cx: 0.2, cy: 0.7, zoom: 2 }, maxColors: 33 };
    expect(sanitizeSettings(s)).toEqual(s);
  });

  it('falls back to defaults for unknown or malformed values', () => {
    const s = sanitizeSettings({
      frameId: '<img src=x onerror=alert(1)>',
      count: '14',
      orientation: 'sideways',
      crop: { cx: 'a', cy: null, zoom: Infinity },
      maxColors: 'many'
    });
    const d = defaultSettings();
    expect(s.frameId).toBe(d.frameId);
    expect(s.count).toBe(d.count);
    expect(s.orientation).toBe(d.orientation);
    expect(s.crop).toEqual(d.crop);
    expect(s.maxColors).toBe(d.maxColors);
  });

  it('clamps numeric ranges', () => {
    const s = sanitizeSettings({ crop: { cx: -5, cy: 9, zoom: 100 }, maxColors: 999.7 });
    expect(s.crop).toEqual({ cx: 0, cy: 1, zoom: MAX_ZOOM });
    expect(s.maxColors).toBe(MAX_COLORS);
    expect(sanitizeSettings({ maxColors: 0 }).maxColors).toBe(MIN_COLORS);
    expect(sanitizeSettings({ maxColors: 12.6 }).maxColors).toBe(13);
  });

  it('tolerates null / non-object input', () => {
    expect(sanitizeSettings(null)).toEqual(defaultSettings());
    expect(sanitizeSettings('x')).toEqual(defaultSettings());
  });
});

describe('isRestorableDraft', () => {
  it('accepts a draft with a reasonably sized image blob', () => {
    expect(isRestorableDraft({ imageBlob: new Blob([new Uint8Array(10)]) })).toBe(true);
  });

  it('rejects missing, non-Blob or oversized images', () => {
    expect(isRestorableDraft(null)).toBe(false);
    expect(isRestorableDraft({})).toBe(false);
    expect(isRestorableDraft({ imageBlob: 'data:image/png;base64,AAAA' })).toBe(false);
    expect(isRestorableDraft({ imageBlob: { size: 10, type: 'image/png' } })).toBe(false);
    const huge = { size: MAX_FILE_BYTES + 1 };
    Object.setPrototypeOf(huge, Blob.prototype);
    expect(isRestorableDraft({ imageBlob: huge })).toBe(false);
  });
});

describe('draft persistence', () => {
  it('saves and loads the image blob with its settings', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    await saveDraft({ image: { blob }, ...defaultSettings(), frameId: '40x50', maxColors: 12 });
    const d = await loadDraft();
    expect(d.imageBlob).toBeTruthy();
    expect(d.frameId).toBe('40x50');
    expect(d.maxColors).toBe(12);
  });

  it('clearDraft removes it', async () => {
    const blob = new Blob([new Uint8Array([1])]);
    await saveDraft({ image: { blob }, ...defaultSettings() });
    await clearDraft();
    expect(await loadDraft()).toBeFalsy();
  });

  it('does not save when there is no image', async () => {
    await saveDraft({ image: null, ...defaultSettings() });
    expect(await loadDraft()).toBeFalsy();
  });
});
