import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub localStorage before importing constants (module-level access)
const store = new Map();
vi.stubGlobal('localStorage', {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
});

const { MOODS, getMood, getPromptCooldownMs, DEFAULT_PROMPT_HOURS } = await import('../../js/lib/constants.js');

describe('MOODS', () => {
  it('has 5 mood entries', () => {
    expect(MOODS).toHaveLength(5);
  });

  it('has values from 5 down to 1', () => {
    expect(MOODS.map(m => m.value)).toEqual([5, 4, 3, 2, 1]);
  });

  it('each mood has required fields', () => {
    for (const mood of MOODS) {
      expect(mood).toHaveProperty('label');
      expect(mood).toHaveProperty('color');
      expect(mood).toHaveProperty('bg');
    }
  });
});

describe('getMood', () => {
  it('returns correct mood for value 5', () => {
    const mood = getMood(5);
    expect(mood.label).toBe('Feliz');
    expect(mood.color).toBe('#F39C12');
  });

  it('returns correct mood for value 1', () => {
    expect(getMood(1).label).toBe('Hecha polvo');
  });

  it('falls back to mood 3 for invalid value', () => {
    expect(getMood(0)).toBe(MOODS[2]);
    expect(getMood(99)).toBe(MOODS[2]);
  });

  it('falls back to mood 3 for undefined', () => {
    expect(getMood(undefined)).toBe(MOODS[2]);
  });
});

describe('getPromptCooldownMs', () => {
  beforeEach(() => {
    store.clear();
  });

  it('returns default 8h when nothing stored', () => {
    expect(getPromptCooldownMs()).toBe(DEFAULT_PROMPT_HOURS * 60 * 60 * 1000);
  });

  it('returns stored hours converted to ms', () => {
    store.set('hayt-prompt-hours', '4');
    expect(getPromptCooldownMs()).toBe(4 * 60 * 60 * 1000);
  });

  it('falls back to default for non-numeric string', () => {
    store.set('hayt-prompt-hours', 'abc');
    expect(getPromptCooldownMs()).toBe(DEFAULT_PROMPT_HOURS * 60 * 60 * 1000);
  });

  it('falls back to default for zero', () => {
    store.set('hayt-prompt-hours', '0');
    expect(getPromptCooldownMs()).toBe(DEFAULT_PROMPT_HOURS * 60 * 60 * 1000);
  });

  it('falls back to default for negative', () => {
    store.set('hayt-prompt-hours', '-2');
    expect(getPromptCooldownMs()).toBe(DEFAULT_PROMPT_HOURS * 60 * 60 * 1000);
  });
});
