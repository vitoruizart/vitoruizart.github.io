import { describe, it, expect, vi } from 'vitest';

// Mock all heavy sync.js dependencies to avoid module-level side effects
vi.mock('../js/github-api.js', () => ({
  getFile: vi.fn(),
  putFile: vi.fn(),
  RateLimitError: class extends Error {},
}));
vi.mock('../js/crypto.js', () => ({
  deriveKey: vi.fn(),
  generateSalt: vi.fn(() => 'mock-salt'),
  encryptEntity: vi.fn((_k, e) => e),
  decryptEntity: vi.fn((_k, e) => e),
  createVerifier: vi.fn(),
  checkVerifier: vi.fn(),
  hasEncryptionKey: vi.fn(() => false),
  getCachedEncryptionKey: vi.fn(),
  cacheEncryptionKey: vi.fn(),
  getCachedSalt: vi.fn(),
  clearEncryptionKey: vi.fn(),
}));
vi.mock('../js/db.js', () => ({
  getAllMoods: vi.fn(async () => []),
  putMood: vi.fn(),
  deleteMood: vi.fn(),
  addChangeEntry: vi.fn(),
  getAllChangeEntries: vi.fn(async () => []),
  clearChangeEntries: vi.fn(),
  getMeta: vi.fn(),
  setMeta: vi.fn(),
}));
vi.mock('../js/components/toast.js', () => ({
  toast: vi.fn(),
}));
vi.mock('../js/state.js', () => ({
  get: vi.fn(),
  set: vi.fn(),
  on: vi.fn(),
  update: vi.fn(),
}));

// Stub localStorage and window (sync.js accesses window._haytSync at module level)
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});
vi.stubGlobal('window', globalThis);

const { isValidMood, safeParseJson } = await import('../js/sync.js');

describe('isValidMood', () => {
  const validMood = {
    id: 'abc-123',
    timestamp: Date.now(),
    date: '2025-03-15',
    mood: 3,
  };

  it('accepts valid mood object', () => {
    expect(isValidMood(validMood)).toBe(true);
  });

  it('accepts mood boundary value 1', () => {
    expect(isValidMood({ ...validMood, mood: 1 })).toBeTruthy();
  });

  it('accepts mood boundary value 5', () => {
    expect(isValidMood({ ...validMood, mood: 5 })).toBeTruthy();
  });

  it('rejects mood value 0', () => {
    expect(isValidMood({ ...validMood, mood: 0 })).toBeFalsy();
  });

  it('rejects mood value 6', () => {
    expect(isValidMood({ ...validMood, mood: 6 })).toBeFalsy();
  });

  it('rejects non-numeric mood', () => {
    expect(isValidMood({ ...validMood, mood: 'happy' })).toBeFalsy();
  });

  it('rejects missing id', () => {
    const { id, ...noId } = validMood;
    expect(isValidMood(noId)).toBeFalsy();
  });

  it('rejects numeric id', () => {
    expect(isValidMood({ ...validMood, id: 123 })).toBeFalsy();
  });

  it('rejects missing timestamp', () => {
    const { timestamp, ...noTs } = validMood;
    expect(isValidMood(noTs)).toBeFalsy();
  });

  it('rejects string timestamp', () => {
    expect(isValidMood({ ...validMood, timestamp: '12345' })).toBeFalsy();
  });

  it('rejects invalid date format', () => {
    expect(isValidMood({ ...validMood, date: '03/15/2025' })).toBeFalsy();
  });

  it('rejects date with single-digit month', () => {
    expect(isValidMood({ ...validMood, date: '2025-3-15' })).toBeFalsy();
  });

  it('rejects null', () => {
    expect(isValidMood(null)).toBeFalsy();
  });

  it('rejects undefined', () => {
    expect(isValidMood(undefined)).toBeFalsy();
  });

  it('rejects empty object', () => {
    expect(isValidMood({})).toBeFalsy();
  });
});

describe('safeParseJson', () => {
  it('parses valid JSON', () => {
    const result = safeParseJson('{"a":1}', 'test');
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it('parses valid array JSON', () => {
    const result = safeParseJson('[1,2,3]', 'test');
    expect(result).toEqual({ ok: true, value: [1, 2, 3] });
  });

  it('returns ok:false for invalid JSON', () => {
    const result = safeParseJson('{bad}', 'test');
    expect(result).toEqual({ ok: false });
  });

  it('returns ok:false for empty string', () => {
    const result = safeParseJson('', 'test');
    expect(result).toEqual({ ok: false });
  });

  it('parses null literal', () => {
    const result = safeParseJson('null', 'test');
    expect(result).toEqual({ ok: true, value: null });
  });

  it('parses string literal', () => {
    const result = safeParseJson('"hello"', 'test');
    expect(result).toEqual({ ok: true, value: 'hello' });
  });

  it('parses number literal', () => {
    const result = safeParseJson('42', 'test');
    expect(result).toEqual({ ok: true, value: 42 });
  });
});
