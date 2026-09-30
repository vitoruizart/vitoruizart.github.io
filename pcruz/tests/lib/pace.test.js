import { afterEach, describe, it, expect } from 'vitest';
import { sanitizePace, loadPace, savePace, DEFAULT_PACE, MIN_PACE, MAX_PACE } from '../../js/lib/pace.js';

function stubStorage() {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  };
  return map;
}

afterEach(() => { delete globalThis.localStorage; });

describe('sanitizePace', () => {
  it('defaults to 30 cuadritos an hour', () => {
    expect(DEFAULT_PACE).toBe(30);
    expect(sanitizePace(null)).toBe(30);
    expect(sanitizePace('')).toBe(30);
    expect(sanitizePace('abc')).toBe(30);
    expect(sanitizePace(NaN)).toBe(30);
    expect(sanitizePace({})).toBe(30);
  });

  it('accepts numbers and numeric strings, snapped to the slider step', () => {
    expect(sanitizePace(45)).toBe(45);
    expect(sanitizePace('120')).toBe(120);
    expect(sanitizePace(32)).toBe(30);
  });

  it('clamps to the slider range', () => {
    expect(sanitizePace(0)).toBe(MIN_PACE);
    expect(sanitizePace(-50)).toBe(MIN_PACE);
    expect(sanitizePace(1e9)).toBe(MAX_PACE);
  });
});

describe('loadPace / savePace', () => {
  it('round-trips through localStorage', () => {
    stubStorage();
    expect(loadPace()).toBe(DEFAULT_PACE);
    savePace(60);
    expect(loadPace()).toBe(60);
  });

  it('sanitizes what it stores and what it reads', () => {
    const map = stubStorage();
    savePace(99999);
    expect(loadPace()).toBe(MAX_PACE);
    map.set('pcruz:stitchesPerHour', '<script>');
    expect(loadPace()).toBe(DEFAULT_PACE);
  });

  it('falls back to the default when storage is unavailable', () => {
    globalThis.localStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(() => savePace(60)).not.toThrow();
    expect(loadPace()).toBe(DEFAULT_PACE);
  });
});

describe('old per-day setting', () => {
  it('is ignored: it meant cuadritos a day, not an hour', () => {
    const map = stubStorage();
    map.set('pcruz:stitchesPerDay', '55');
    expect(loadPace()).toBe(DEFAULT_PACE);
  });
});
